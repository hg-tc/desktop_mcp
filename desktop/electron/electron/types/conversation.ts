/**
 * 对话相关类型定义
 */

/**
 * 消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 消息
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * 对话状态
 */
export interface ConversationState {
  messages: Message[];
  isProcessing: boolean;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * LLM 响应
 */
export interface LlmResponse {
  content: string | null;
  role: 'assistant';
  toolCalls?: ToolCall[];
  finishReason?: string;
}

/**
 * 流式响应块
 */
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

