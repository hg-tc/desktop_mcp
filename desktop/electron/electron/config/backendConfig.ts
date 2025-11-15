import { app } from 'electron';
import path from 'path';
import { configManager } from './appConfig';
import { SettingsStore } from '../settings';
import type { GoBackendServiceOptions } from '../services/GoBackendService';
import type { PythonBackendServiceOptions } from '../services/PythonBackendService';

// 全局 SettingsStore 实例（在 AppLifecycle 中初始化）
let settingsStoreInstance: SettingsStore | null = null;

export function setSettingsStore(store: SettingsStore) {
  settingsStoreInstance = store;
}

/**
 * 获取 Go 后端服务配置
 */
export function getGoBackendConfig(): GoBackendServiceOptions {
  const config = configManager.get('backend').go;

  return {
    port: config.port,
    browserBin: config.browserBin,
    cookiesPath: config.cookiesPath ?? path.join(app.getPath('userData'), 'cookies', 'cookies.json')
  };
}

/**
 * 获取 Python 后端服务配置
 */
export async function getPythonBackendConfig(): Promise<PythonBackendServiceOptions> {
  const config = configManager.get('backend').python;
  
  // 优先从 SettingsStore 读取（用户通过 UI 配置的）
  let apiKey: string | undefined;
  let baseUrl: string;
  let model: string;
  let headers: Record<string, string> | undefined;

  if (settingsStoreInstance) {
    try {
      const runtimeConfig = await settingsStoreInstance.getLlmRuntimeConfig();
      if (runtimeConfig) {
        apiKey = runtimeConfig.apiKey;
        baseUrl = runtimeConfig.baseUrl;
        model = runtimeConfig.model;
        headers = runtimeConfig.headers;
      } else {
        // 如果没有配置，使用默认值
        const llmConfig = configManager.get('llm');
        baseUrl = llmConfig.baseUrl;
        model = llmConfig.model;
        headers = llmConfig.headers;
      }
    } catch (error) {
      // 如果读取失败，回退到 configManager
      const llmConfig = configManager.get('llm');
      apiKey = llmConfig.apiKey;
      baseUrl = llmConfig.baseUrl;
      model = llmConfig.model;
      headers = llmConfig.headers;
    }
  } else {
    // 如果没有 SettingsStore，使用 configManager
    const llmConfig = configManager.get('llm');
    apiKey = llmConfig.apiKey;
    baseUrl = llmConfig.baseUrl;
    model = llmConfig.model;
    headers = llmConfig.headers;
  }

  return {
    port: config.port,
    apiKey,
    baseUrl,
    model,
    headers
  };
}

