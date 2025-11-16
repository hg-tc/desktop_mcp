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
  // 过滤无害的系统警告和 DevTools 警告
  // 这些错误来自系统底层和 DevTools 内部，不影响应用功能
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: any, encoding?: any, callback?: any) => {
    const message = chunk?.toString() || '';
    
    // 过滤规则列表
    const shouldFilter = [
      // DevTools Autofill 相关错误
      "Autofill.enable",
      "Autofill.setAddresses",
      "'Autofill.",
      "Request Autofill.",
      // macOS 输入法系统相关警告
      "TSM AdjustCapsLockLED",
      "IMKCFRunLoopWakeUpReliable",
      "error messaging the mach port",
      "_ISSetPhysicalKeyboardCapsLockLED",
    ].some(pattern => message.includes(pattern));
    
    if (shouldFilter) {
      // 静默处理，不输出
      if (typeof callback === 'function') {
        callback();
      }
      return true;
    }
    return originalStderrWrite(chunk, encoding, callback);
  };

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
