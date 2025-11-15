import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionCreateParams
} from 'openai/resources/chat/completions';
import log from 'electron-log';
import WebSocket from 'ws';

export interface LlmClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  headers?: Record<string, string>;
  wsUrl?: string; // WebSocket 服务器地址，如果未提供则从 baseUrl 推导
}

export interface LlmResponse {
  content: string | null;
  role: 'assistant';
  toolCalls?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }[];
  finishReason?: string;
}

export interface StreamChunk {
  type: 'chunk' | 'tool_call' | 'done' | 'error';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: Record<string, unknown> | string;
    };
  }>;
  finish_reason?: string;
  error?: string;
  done: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export class LlmClient {
  private wsUrl: string;
  private config: LlmClientConfig;

  constructor(config: LlmClientConfig) {
    this.config = config;
    // 从 baseUrl 推导 WebSocket URL，或使用提供的 wsUrl
    if (config.wsUrl) {
      this.wsUrl = config.wsUrl;
    } else {
      // 将 http:// 或 https:// 转换为 ws:// 或 wss://
      const url = new URL(config.baseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      // 默认端口 18061
      if (!url.port || url.port === '80' || url.port === '443') {
        url.port = '18061';
      }
      this.wsUrl = url.toString().replace(/\/$/, '') + '/ws';
    }
    
    log.info('LLM client initialized', {
      wsUrl: this.wsUrl,
      model: config.model,
      baseUrl: config.baseUrl
    });
  }

  async createChatCompletion(params: {
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    temperature?: number;
    toolChoice?: ChatCompletionCreateParams.ToolChoice;
    onStream?: StreamCallback;
  }): Promise<LlmResponse> {
    const { messages, tools, temperature = 0.3, toolChoice, onStream } = params;

    log.info('Creating chat completion via WebSocket', {
      model: this.config.model,
      messageCount: messages.length,
      toolCount: tools?.length ?? 0,
      hasTools: Boolean(tools && tools.length > 0),
      toolChoice: toolChoice ? JSON.stringify(toolChoice) : 'auto',
      stream: Boolean(onStream)
    });

    return new Promise<LlmResponse>((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      let accumulatedContent = '';
      let toolCalls: LlmResponse['toolCalls'] = [];
      let finishReason: string | undefined;
      let hasError = false;

      const timeout = setTimeout(() => {
        if (!hasError) {
          hasError = true;
          ws.close();
          reject(new Error('WebSocket 请求超时'));
        }
      }, 120_000); // 120秒超时

      ws.on('open', () => {
        log.debug('WebSocket 连接已建立');
        
        // 准备请求数据
        const request = {
          type: 'chat',
          messages: messages.map((msg) => {
            // 转换消息格式
            if (msg.role === 'tool' && 'tool_call_id' in msg) {
              return {
                role: 'tool',
                content: msg.content,
                tool_call_id: msg.tool_call_id
              };
            } else if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
              return {
                role: 'assistant',
                content: msg.content || '',
                tool_calls: msg.tool_calls.map((tc) => ({
                  id: tc.id,
                  name: tc.function.name,
                  arguments: typeof tc.function.arguments === 'string' 
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments
                }))
              };
            } else {
              return {
                role: msg.role,
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
              };
            }
          }),
          tools: tools?.map((tool) => ({
            type: 'function',
            function: tool.function
          })),
          config: {
            model: this.config.model,
            temperature,
            stream: Boolean(onStream),
            ...(toolChoice ? { tool_choice: toolChoice } : {})
          }
        };

        ws.send(JSON.stringify(request));
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const chunk: StreamChunk = JSON.parse(data.toString());
          
          if (chunk.type === 'chunk' && chunk.content) {
            accumulatedContent += chunk.content;
            if (onStream) {
              onStream(chunk);
            }
          } else if (chunk.type === 'tool_call' && chunk.tool_calls) {
            // 处理工具调用
            toolCalls = chunk.tool_calls.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments
            }));
            if (onStream) {
              onStream(chunk);
            }
          } else if (chunk.type === 'done') {
            finishReason = chunk.finish_reason;
            if (chunk.content) {
              accumulatedContent = chunk.content;
            }
            if (onStream) {
              onStream(chunk);
            }
            
            clearTimeout(timeout);
            hasError = false;
            ws.close();
            
            resolve({
              content: accumulatedContent || null,
              role: 'assistant',
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              finishReason
            });
          } else if (chunk.type === 'error') {
            clearTimeout(timeout);
            hasError = true;
            ws.close();
            reject(new Error(chunk.error || '未知错误'));
          }
        } catch (error) {
          log.error('解析 WebSocket 消息失败', error);
          if (!hasError) {
            hasError = true;
            clearTimeout(timeout);
            ws.close();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }
      });

      ws.on('error', (error) => {
        log.error('WebSocket 错误', error);
        if (!hasError) {
          hasError = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!hasError && !finishReason) {
          // 连接关闭但没有收到完成消息，可能是异常关闭
          if (!hasError) {
            hasError = true;
            reject(new Error('WebSocket 连接意外关闭'));
          }
        }
      });
    });
  }
}
