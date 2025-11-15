import { BrowserWindow } from 'electron';
import { BackendServiceManager } from '../services/BackendServiceManager';
import { SettingsStore } from '../settings';
import { ConversationManager } from '../agent/conversationManager';
import { BackendHandler } from './handlers/backendHandler';
import { SettingsHandler } from './handlers/settingsHandler';
import { ConversationHandler } from './handlers/conversationHandler';
import { AppHandler } from './handlers/appHandler';
import { logger } from '../utils/logger';

/**
 * IPC 处理器管理器
 */
export class IpcHandler {
  private backendHandler: BackendHandler;
  private settingsHandler: SettingsHandler;
  private conversationHandler: ConversationHandler;
  private appHandler: AppHandler;

  constructor(
    private readonly serviceManager: BackendServiceManager,
    private readonly settingsStore: SettingsStore,
    private readonly conversationManager: ConversationManager
  ) {
    this.backendHandler = new BackendHandler(serviceManager);
    this.settingsHandler = new SettingsHandler(settingsStore, conversationManager);
    this.conversationHandler = new ConversationHandler(conversationManager);
    this.appHandler = new AppHandler();
  }

  /**
   * 注册所有 IPC 处理器
   */
  register(): void {
    logger.info('Registering IPC handlers');
    this.backendHandler.register();
    this.settingsHandler.register();
    this.conversationHandler.register();
    this.appHandler.register();
    logger.info('IPC handlers registered');
  }

  /**
   * 注册事件监听器（需要窗口实例）
   */
  registerEventListeners(window: BrowserWindow | null): void {
    if (window) {
      this.conversationHandler.registerEventListeners(window);
    }
  }
}

