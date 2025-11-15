import { ipcMain } from 'electron';
import { IpcChannel } from '../types';
import { ConversationManager } from '../../agent/conversationManager';
import { ErrorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import type { ConversationState } from '../../types';

/**
 * 对话 IPC 处理器
 */
export class ConversationHandler {
  constructor(private readonly conversationManager: ConversationManager) {}

  /**
   * 注册所有对话相关的 IPC 处理器
   */
  register(): void {
    ipcMain.handle(IpcChannel.ConversationGetState, (): ConversationState => {
      try {
        return this.conversationManager.getState();
      } catch (error) {
        logger.error('Failed to get conversation state', error);
        throw ErrorHandler.handleError(error, 'conversation:get-state');
      }
    });

    ipcMain.handle(
      IpcChannel.ConversationSend,
      async (_event, payload: { content: string }): Promise<ConversationState> => {
        try {
          return await this.conversationManager.sendUserMessage(payload.content);
        } catch (error) {
          logger.error('Failed to send message', error);
          throw ErrorHandler.handleError(error, 'conversation:send');
        }
      }
    );

    ipcMain.handle(IpcChannel.ConversationReset, (): ConversationState => {
      try {
        this.conversationManager.resetConversation();
        return this.conversationManager.getState();
      } catch (error) {
        logger.error('Failed to reset conversation', error);
        throw ErrorHandler.handleError(error, 'conversation:reset');
      }
    });
  }

  /**
   * 注册对话事件监听器
   */
  registerEventListeners(window: Electron.BrowserWindow | null): void {
    if (!window) return;

    this.conversationManager.on('message', (message) => {
      window.webContents.send(IpcChannel.ConversationMessage, message);
    });

    this.conversationManager.on('status', (status) => {
      window.webContents.send(IpcChannel.ConversationStatus, status);
    });

    this.conversationManager.on('error', (error) => {
      window.webContents.send(IpcChannel.ConversationError, {
        message: error.message,
        stack: error.stack
      });
    });
  }
}

