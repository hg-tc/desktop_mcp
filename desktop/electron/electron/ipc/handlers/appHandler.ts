import { ipcMain, shell } from 'electron';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { IpcChannel } from '../types';
import { ErrorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * 应用 IPC 处理器
 */
export class AppHandler {
  /**
   * 注册所有应用相关的 IPC 处理器
   */
  register(): void {
    ipcMain.handle(IpcChannel.AppOpenExternal, async (_event, url: string): Promise<void> => {
      try {
        await shell.openExternal(url);
      } catch (error) {
        logger.error('Failed to open external URL', error);
        throw ErrorHandler.handleError(error, 'app:open-external');
      }
    });

    ipcMain.handle(IpcChannel.AppGetPlatform, () => {
      try {
        return {
          platform: process.platform,
          release: os.release()
        };
      } catch (error) {
        logger.error('Failed to get platform info', error);
        throw ErrorHandler.handleError(error, 'app:get-platform');
      }
    });

    ipcMain.handle(IpcChannel.AppGetList, async () => {
      try {
        // 从配置文件加载应用列表
        const configPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'config', 'apps.config.json');
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          return config.apps || [];
        }
        return [];
      } catch (error) {
        logger.error('Failed to get app list', error);
        throw ErrorHandler.handleError(error, 'app:get-list');
      }
    });

    ipcMain.handle(IpcChannel.AppGetInfo, async (_event, appId: string) => {
      try {
        // 从配置文件加载应用列表
        const configPath = path.join(__dirname, '..', '..', 'src', 'renderer', 'config', 'apps.config.json');
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          const apps = config.apps || [];
          const app = apps.find((a: any) => a.id === appId);
          return app || null;
        }
        return null;
      } catch (error) {
        logger.error('Failed to get app info', error);
        throw ErrorHandler.handleError(error, 'app:get-info');
      }
    });
  }
}

