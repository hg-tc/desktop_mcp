/**
 * 设置相关类型定义
 */

/**
 * LLM 设置视图（不包含敏感信息）
 */
export interface LlmSettingsView {
  provider: string;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  headers?: Record<string, string>;
}

/**
 * LLM 运行时配置（包含敏感信息）
 */
export interface LlmRuntimeConfig {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  headers?: Record<string, string>;
}

/**
 * 浏览器选项
 */
export interface BrowserOptions {
  binPath?: string;
  headless?: boolean;
}

/**
 * 设置更新参数
 */
export interface LlmSettingsUpdate {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string | null;
  headers?: Record<string, string>;
}

export interface BrowserOptionsUpdate {
  binPath?: string;
  headless?: boolean;
}

