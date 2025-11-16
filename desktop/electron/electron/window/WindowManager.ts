import { BrowserWindow } from 'electron';
import path from 'path';
import { getWindowConfig } from './windowConfig';
import { getRendererDistPath, getPreloadPath } from '../utils/path';
import { logger } from '../utils/logger';

/**
 * 窗口管理器
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private readonly isDev = process.env.NODE_ENV !== 'production';

  /**
   * 创建主窗口
   */
  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow) {
      return this.mainWindow;
    }

    const config = getWindowConfig();
    logger.info('Creating main window', config);

    this.mainWindow = new BrowserWindow({
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      autoHideMenuBar: config.autoHideMenuBar,
      webPreferences: {
        preload: getPreloadPath(),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        // 禁用一些 DevTools 功能以减少控制台警告
        devTools: this.isDev
      }
    });

    // 过滤 DevTools 的无害警告（Autofill API 等）
    // 这些错误来自 DevTools 内部，不影响应用功能
    this.mainWindow.webContents.on('console-message', (event, level, message) => {
      // 过滤掉 DevTools 内部的 Autofill 相关错误
      if (
        typeof message === 'string' &&
        (message.includes("Autofill.enable") || 
         message.includes("Autofill.setAddresses") ||
         message.includes("'Autofill.") ||
         message.includes("Request Autofill."))
      ) {
        // 静默处理，不输出到控制台
        return;
      }
    });

    // 加载页面
    if (this.isDev && process.env.ELECTRON_START_URL) {
      await this.mainWindow.loadURL(process.env.ELECTRON_START_URL);
      
      // 打开 DevTools
      this.mainWindow.webContents.openDevTools({ 
        mode: 'detach',
      });
    } else {
      await this.mainWindow.loadFile(path.join(getRendererDistPath(), 'index.html'));
    }

    // 监听窗口关闭
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      logger.info('Main window closed');
    });

    logger.info('Main window created');
    return this.mainWindow;
  }

  /**
   * 获取主窗口
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * 关闭主窗口
   */
  closeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.close();
    }
  }

  /**
   * 检查窗口是否存在
   */
  hasWindow(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }
}

