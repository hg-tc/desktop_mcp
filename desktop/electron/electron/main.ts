import { app } from 'electron';
import { WindowManager } from './window/WindowManager';
import { BackendServiceManager } from './services/BackendServiceManager';
import { SettingsStore } from './settings';
import { McpClientManager } from './mcpClient';
import { ConversationManager } from './agent/conversationManager';
import { IpcHandler } from './ipc/IpcHandler';
import { AppLifecycle } from './lifecycle/AppLifecycle';
import { logger } from './utils/logger';

/**
 * 应用入口
 */
async function main() {
  // 初始化日志
  logger.info('Starting application');

  // 创建核心组件
  const windowManager = new WindowManager();
  const serviceManager = new BackendServiceManager();
  const settingsStore = new SettingsStore();
  const mcpManager = new McpClientManager();
  const conversationManager = new ConversationManager(settingsStore, mcpManager);
  const ipcHandler = new IpcHandler(serviceManager, settingsStore, conversationManager);

  // 创建应用生命周期管理器
  const appLifecycle = new AppLifecycle(
    windowManager,
    serviceManager,
    ipcHandler,
    conversationManager
  );

  // 初始化应用
  app.whenReady().then(async () => {
    await appLifecycle.initialize();
  });
}

// 启动应用
main().catch((error) => {
  logger.error('Failed to start application', error);
  app.exit(1);
});
