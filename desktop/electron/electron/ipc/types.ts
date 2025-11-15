/**
 * IPC 通信类型定义
 */

/**
 * IPC 通道名称
 */
export enum IpcChannel {
  // 后端相关
  BackendGetInfo = 'backend:get-info',
  BackendStatus = 'backend:status',
  BackendGetStatus = 'backend:get-status',
  LlmBackendStatus = 'llm-backend:status',

  // 应用相关
  AppOpenExternal = 'app:open-external',
  AppGetPlatform = 'app:get-platform',
  AppGetList = 'app:get-list',
  AppGetInfo = 'app:get-info',

  // 设置相关
  SettingsGetLlm = 'settings:get-llm',
  SettingsUpdateLlm = 'settings:update-llm',
  SettingsGetBrowser = 'settings:get-browser',
  SettingsUpdateBrowser = 'settings:update-browser',

  // 对话相关
  ConversationGetState = 'conversation:get-state',
  ConversationSend = 'conversation:send',
  ConversationReset = 'conversation:reset',
  ConversationMessage = 'conversation:message',
  ConversationStatus = 'conversation:status',
  ConversationError = 'conversation:error'
}

