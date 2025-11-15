import { ipcMain } from 'electron';
import { IpcChannel } from '../types';
import { SettingsStore } from '../../settings';
import { ConversationManager } from '../../agent/conversationManager';
import { ErrorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import type {
  LlmSettingsView,
  LlmSettingsUpdate,
  BrowserOptions,
  BrowserOptionsUpdate
} from '../../types';

/**
 * 设置 IPC 处理器
 */
export class SettingsHandler {
  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly conversationManager: ConversationManager
  ) {}

  /**
   * 注册所有设置相关的 IPC 处理器
   */
  register(): void {
    // LLM 设置
    ipcMain.handle(IpcChannel.SettingsGetLlm, async (): Promise<LlmSettingsView> => {
      try {
        return await this.settingsStore.getLlmSettingsView();
      } catch (error) {
        logger.error('Failed to get LLM settings', error);
        throw ErrorHandler.handleError(error, 'settings:get-llm');
      }
    });

    ipcMain.handle(
      IpcChannel.SettingsUpdateLlm,
      async (_event, payload: LlmSettingsUpdate): Promise<LlmSettingsView> => {
        try {
          await this.settingsStore.updateLlmSettings(payload);
          await this.conversationManager.refreshLlmClient();
          
          // 通知用户需要重启 Python 后端以应用新的 API Key
          // 注意：这里不自动重启，因为需要用户手动重启应用
          logger.info('LLM settings updated. Python backend restart required for API key changes.');
          
          return await this.settingsStore.getLlmSettingsView();
        } catch (error) {
          logger.error('Failed to update LLM settings', error);
          throw ErrorHandler.handleError(error, 'settings:update-llm');
        }
      }
    );

    // 浏览器设置
    ipcMain.handle(IpcChannel.SettingsGetBrowser, async (): Promise<BrowserOptions> => {
      try {
        return await this.settingsStore.getBrowserOptions();
      } catch (error) {
        logger.error('Failed to get browser settings', error);
        throw ErrorHandler.handleError(error, 'settings:get-browser');
      }
    });

    ipcMain.handle(
      IpcChannel.SettingsUpdateBrowser,
      async (_event, payload: BrowserOptionsUpdate): Promise<BrowserOptions> => {
        try {
          await this.settingsStore.setBrowserOptions(payload);
          return await this.settingsStore.getBrowserOptions();
        } catch (error) {
          logger.error('Failed to update browser settings', error);
          throw ErrorHandler.handleError(error, 'settings:update-browser');
        }
      }
    );
  }
}

