import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions';
import log from 'electron-log';
import { LlmClient, type LlmClientConfig, type LlmResponse } from './llmClient';
import type { McpClientManager, CallToolResponse } from '../mcpClient';
import type { SettingsStore } from '../settings';
import type { Tool } from '@modelcontextprotocol/sdk/types';

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationState {
  messages: AgentMessage[];
  isProcessing: boolean;
}

export interface ConversationEvents {
  message: (message: AgentMessage) => void;
  status: (payload: { isProcessing: boolean; reason?: string }) => void;
  error: (error: Error) => void;
}

const SYSTEM_PROMPT = `你是一名熟悉小红书平台运营和数据的智能助理。你可以通过 MCP 工具访问小红书相关的接口，例如检测登录状态、获取二维码、发布笔记、搜索内容等。

重要：当用户提出涉及小红书的具体操作或查询时，你必须使用提供的工具来获取真实数据，而不是猜测或编造答案。

使用说明：
1. 当用户询问小红书相关内容（如搜索、发布、查看笔记等）时，必须调用相应的工具。
2. 工具执行成功后，将结果整理成自然语言回答；必要时引用关键字段。
3. 如果工具调用失败，请分析错误并给出下一步建议。
4. 若需求与小红书无关，可直接回答，但请说明你主要擅长小红书运营相关工作。
5. 始终以中文回答，语气专业、简洁、友好。

可用工具已通过 tools 参数提供，请根据用户需求选择合适的工具并调用。`;

const MAX_ITERATIONS = 6;

export class ConversationManager extends EventEmitter {
  private messages: AgentMessage[] = [];
  private llmClient: LlmClient | null = null;
  private llmConfig: LlmClientConfig | null = null;
  private tools: Tool[] = [];
  private toolDefinitions: ChatCompletionTool[] = [];
  private backendBaseUrl: string | null = null;
  private processingQueue: Promise<void> = Promise.resolve();
  private isProcessing = false;

  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly mcpManager: McpClientManager
  ) {
    super();
    this.appendMessage({
      role: 'system',
      content: SYSTEM_PROMPT
    });
  }

  setBackendBaseUrl(url: string) {
    this.backendBaseUrl = url;
  }

  getState(): ConversationState {
    return {
      messages: [...this.messages],
      isProcessing: this.isProcessing
    };
  }

  async refreshLlmClient(wsUrl?: string) {
    const config = await this.settingsStore.getLlmRuntimeConfig();
    if (!config) {
      this.llmClient = null;
      this.llmConfig = null;
      return;
    }
    const needsRefresh =
      !this.llmConfig ||
      this.llmConfig.apiKey !== config.apiKey ||
      this.llmConfig.baseUrl !== config.baseUrl ||
      this.llmConfig.model !== config.model ||
      (wsUrl && this.llmConfig.wsUrl !== wsUrl);
    if (needsRefresh) {
      this.llmConfig = { ...config, wsUrl };
      this.llmClient = new LlmClient(this.llmConfig);
      log.info('LLM client refreshed', { wsUrl });
    }
  }

  async sendUserMessage(content: string) {
    return this.enqueue(async () => {
      this.appendMessage({
        role: 'user',
        content
      });
      this.updateStatus(true, 'processing');

      try {
        if (!this.backendBaseUrl) {
          throw new Error('后端服务尚未启动');
        }
        await this.refreshLlmClient();
        if (!this.llmClient) {
          throw new Error('尚未配置可用的 LLM API Key');
        }

        await this.ensureTools();

        // 创建 assistant 消息占位符，用于流式更新
        let assistantMessageId: string | null = null;
        const streamCallback = (chunk: import('./llmClient').StreamChunk) => {
          if (chunk.type === 'chunk' && chunk.content) {
            if (!assistantMessageId) {
              // 创建新的 assistant 消息
              const msg = this.appendMessage({
                role: 'assistant',
                content: chunk.content,
                metadata: {}
              });
              assistantMessageId = msg.id;
            } else {
              // 更新现有消息
              const msg = this.messages.find((m) => m.id === assistantMessageId);
              if (msg) {
                msg.content += chunk.content;
                this.emit('message', { ...msg });
              }
            }
          } else if (chunk.type === 'tool_call' && chunk.tool_calls) {
            // 工具调用：更新消息元数据
            if (assistantMessageId) {
              const msg = this.messages.find((m) => m.id === assistantMessageId);
              if (msg) {
                msg.metadata = {
                  ...msg.metadata,
                  toolCalls: chunk.tool_calls.map((tc) => ({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: typeof tc.function.arguments === 'string'
                      ? JSON.parse(tc.function.arguments)
                      : tc.function.arguments
                  }))
                };
                this.emit('message', { ...msg });
              }
            }
          }
        };

        const result = await this.runAgentLoop(streamCallback);
        if (result) {
          // 如果流式更新已经创建了消息，只需更新元数据
          if (assistantMessageId) {
            const msg = this.messages.find((m) => m.id === assistantMessageId);
            if (msg) {
              msg.metadata = {
                ...msg.metadata,
                finishReason: result.finishReason
              };
              this.emit('message', { ...msg });
            }
          } else {
            // 如果没有流式更新，创建完整消息
            this.appendMessage({
              role: 'assistant',
              content: result.content ?? '(空回复)',
              metadata: {
                finishReason: result.finishReason
              }
            });
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '处理请求时发生未知错误';
        this.appendMessage({
          role: 'assistant',
          content: `抱歉，处理请求时出现问题：${message}`,
          metadata: { error: true }
        });
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      } finally {
        this.updateStatus(false);
      }

      return this.getState();
    });
  }

  resetConversation() {
    this.messages = [];
    this.appendMessage({
      role: 'system',
      content: SYSTEM_PROMPT
    });
    this.emit('status', { isProcessing: false, reason: 'reset' });
  }

  private async ensureTools() {
    if (!this.backendBaseUrl) {
      throw new Error('后端服务尚未启动');
    }
    this.tools = await this.mcpManager.listTools(this.backendBaseUrl);
    this.toolDefinitions = this.tools.map((tool) => {
      // MCP SDK 的 inputSchema 已经是 JSON Schema 格式，可以直接使用
      // 但需要确保格式完全兼容 OpenAI
      let schema = tool.inputSchema;
      if (!schema || typeof schema !== 'object') {
        schema = {
          type: 'object',
          properties: {},
          additionalProperties: true
        };
      } else {
        // 确保 schema 是有效的 JSON Schema 对象
        // 移除可能不兼容的字段，保留 OpenAI 支持的字段
        schema = {
          type: schema.type ?? 'object',
          properties: schema.properties ?? {},
          required: schema.required ?? [],
          // OpenAI 支持 additionalProperties，但 MCP 可能没有
          ...(schema.additionalProperties !== undefined
            ? { additionalProperties: schema.additionalProperties }
            : {})
        };
      }

      // 确保 description 不为空，这对工具调用很重要
      const description =
        tool.description ?? tool.name ?? `执行 ${tool.name} 操作`;
      log.info('Tool definition', {
        name: tool.name,
        description: description.substring(0, 50),
        hasSchema: Boolean(schema),
        schemaType: schema.type,
        propertyCount: Object.keys(schema.properties ?? {}).length
      });
      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: description,
          parameters: schema
        }
      };
    });
    log.info('Total tools registered', {
      count: this.toolDefinitions.length,
      toolNames: this.toolDefinitions.map((t) => t.function.name)
    });
  }

  private async runAgentLoop(
    onStream?: (chunk: import('./llmClient').StreamChunk) => void
  ): Promise<LlmResponse | null> {
    let iterations = 0;
    let lastResponse: LlmResponse | null = null;
    let lastUserMessage: string | null = null;
    let hasCalledTool = false; // 跟踪是否已经调用过工具

    // 检查最后一条用户消息，判断是否需要工具调用
    const lastUserMsg = this.messages
      .slice()
      .reverse()
      .find((m) => m.role === 'user');
    if (lastUserMsg) {
      lastUserMessage = lastUserMsg.content.toLowerCase();
    }

    const needsToolCall =
      lastUserMessage &&
      (lastUserMessage.includes('搜索') ||
        lastUserMessage.includes('查找') ||
        lastUserMessage.includes('发布') ||
        lastUserMessage.includes('登录') ||
        lastUserMessage.includes('查看') ||
        lastUserMessage.includes('获取') ||
        lastUserMessage.includes('list') ||
        lastUserMessage.includes('search') ||
        lastUserMessage.includes('publish') ||
        lastUserMessage.includes('agent'));

    while (iterations < MAX_ITERATIONS) {
      iterations += 1;
      const messages = this.buildChatMessages();
      let forcedToolChoice: ChatCompletionCreateParams.ToolChoice | undefined;

      // 如果明显需要工具调用但上次没有调用，添加更明确的提示
      // 但只有在从未调用过工具的情况下才强制
      if (
        iterations === 2 &&
        needsToolCall &&
        !hasCalledTool &&
        !lastResponse?.toolCalls?.length &&
        lastResponse?.finishReason === 'stop'
      ) {
        log.info('Adding tool call reminder', { userMessage: lastUserMessage });
        // 找到合适的工具并明确要求调用
        let suggestedTool = 'search_feeds';
        if (lastUserMessage?.includes('搜索') || lastUserMessage?.includes('search')) {
          suggestedTool = 'search_feeds';
        } else if (lastUserMessage?.includes('发布') || lastUserMessage?.includes('publish')) {
          suggestedTool = 'publish_content';
        } else if (lastUserMessage?.includes('登录') || lastUserMessage?.includes('login')) {
          suggestedTool = 'check_login_status';
        }
        forcedToolChoice = {
          type: 'function',
          function: {
            name: suggestedTool
          }
        };
        messages.push({
          role: 'user',
          content: `你必须使用工具来执行操作。请立即调用 ${suggestedTool} 工具，不要只是说"开始搜索"或"请稍候"。工具调用是必需的，不能跳过。`
        });
      }

      // 在第一次迭代时，如果明显需要工具调用，在系统提示中强调
      if (iterations === 1 && needsToolCall && this.toolDefinitions.length > 0) {
        // 在消息列表末尾添加一个强调工具使用的用户消息
        const enhancedMessages = [...messages];
        enhancedMessages.push({
          role: 'user',
          content: '重要：你必须使用提供的工具来执行操作。不要只是描述你会做什么，必须实际调用工具。'
        });
        
        const response = await this.llmClient!.createChatCompletion({
          messages: enhancedMessages,
          tools: this.toolDefinitions,
          toolChoice: forcedToolChoice,
          onStream: undefined // 工具调用阶段不使用流式响应
        });
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          hasCalledTool = true; // 标记已调用工具
          this.appendMessage({
            role: 'assistant',
            content: response.content ?? '',
            metadata: {
              toolCalls: response.toolCalls
            }
          });

          for (const call of response.toolCalls) {
            const result = await this.executeToolCall(call);
            this.appendMessage({
              role: 'tool',
              content: result.content,
              metadata: {
                toolName: call.name,
                raw: result.raw,
                isError: result.isError,
                callId: call.id
              }
            });
          }
          lastResponse = response;
          continue;
        }
        
        lastResponse = response;
        // 如果第一次没有调用工具，继续到第二次迭代
        continue;
      }

      // 判断是否应该使用流式响应：只有在最后一次迭代且不需要工具调用时才使用
      const shouldStream = !needsToolCall || hasCalledTool || iterations >= MAX_ITERATIONS - 1;
      
      const response = await this.llmClient!.createChatCompletion({
        messages,
        tools: this.toolDefinitions,
        toolChoice: forcedToolChoice,
        onStream: shouldStream ? onStream : undefined
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        hasCalledTool = true; // 标记已调用工具
        this.appendMessage({
          role: 'assistant',
          content: response.content ?? '',
          metadata: {
            toolCalls: response.toolCalls
          }
        });

        for (const call of response.toolCalls) {
          const result = await this.executeToolCall(call);
          this.appendMessage({
            role: 'tool',
            content: result.content,
            metadata: {
              toolName: call.name,
              raw: result.raw,
              isError: result.isError,
              callId: call.id
            }
          });
        }
        lastResponse = response;
        continue;
      }

      lastResponse = response;
      
      // 只有在从未调用过工具且明显需要工具调用时才报错
      // 如果已经调用过工具，后续迭代生成回复是正常的
      if (
        needsToolCall &&
        !hasCalledTool &&
        !response.toolCalls?.length &&
        response.finishReason === 'stop' &&
        iterations >= 2
      ) {
        log.warn('Model did not call tools despite clear need', {
          iterations,
          finishReason: response.finishReason,
          userMessage: lastUserMessage,
          hasCalledTool
        });
        throw new Error(
          '模型没有调用工具。这可能是因为：\n' +
          '1. 当前模型可能不支持工具调用功能\n' +
          '2. 请尝试切换到标准的模型名称（如 deepseek-chat）\n' +
          '3. 请检查 API 服务是否支持工具调用功能'
        );
      }
      
      // 如果已经调用过工具，或者不需要工具调用，正常结束
      break;
    }

    return lastResponse;
  }

  private async executeToolCall(call: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<CallToolResponse> {
    log.info('Executing tool call', {
      toolName: call.name,
      arguments: call.arguments,
      backendBaseUrl: this.backendBaseUrl
    });
    try {
      const startTime = Date.now();
      const result = await this.mcpManager.callTool(
        call.name,
        call.arguments,
        this.backendBaseUrl ?? undefined
      );
      const duration = Date.now() - startTime;
      log.info('Tool call completed', {
        toolName: call.name,
        duration: `${duration}ms`,
        isError: result.isError,
        contentLength: result.content.length
      });
      if (result.content.trim().length === 0) {
        return {
          ...result,
          content: '工具调用成功，但未返回文本内容。'
        };
      }
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      log.error('Tool call failed', {
        toolName: call.name,
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        content: `调用工具 ${call.name} 失败：${message}`,
        raw: null,
        isError: true
      };
    }
  }

  private buildChatMessages(): ChatCompletionMessageParam[] {
    const result: ChatCompletionMessageParam[] = [];
    for (const message of this.messages) {
      switch (message.role) {
        case 'system':
        case 'user':
          result.push({ role: message.role, content: message.content });
          break;
        case 'assistant': {
          const toolCalls = message.metadata?.toolCalls;
          if (toolCalls && Array.isArray(toolCalls)) {
            result.push({
              role: 'assistant',
              content: message.content,
              tool_calls: toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.arguments ?? {})
                }
              }))
            });
          } else {
            result.push({ role: 'assistant', content: message.content });
          }
          break;
        }
        case 'tool': {
          const callId = message.metadata?.callId;
          if (!callId) {
            continue;
          }
          result.push({
            role: 'tool',
            tool_call_id: String(callId),
            content: message.content
          });
          break;
        }
      }
    }
    return result;
  }

  private appendMessage(message: Omit<AgentMessage, 'id' | 'createdAt'>) {
    const record: AgentMessage = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...message
    };
    this.messages.push(record);
    this.emit('message', record);
  }

  private updateStatus(isProcessing: boolean, reason?: string) {
    this.isProcessing = isProcessing;
    this.emit('status', { isProcessing, reason });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const runTask = async () => {
      try {
        return await task();
      } catch (error) {
        throw error;
      }
    };
    const next = this.processingQueue.then(runTask, runTask);
    // ensure queue continues even if previous tasks fail
    this.processingQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

