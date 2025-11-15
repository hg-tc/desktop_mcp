import { app, dialog } from 'electron';
import { WindowManager } from '../window/WindowManager';
import { BackendServiceManager } from '../services/BackendServiceManager';
import { GoBackendService } from '../services/GoBackendService';
import { PythonBackendService } from '../services/PythonBackendService';
import { ConversationManager } from '../agent/conversationManager';
import { IpcHandler } from '../ipc/IpcHandler';
import { configManager } from '../config';
import { getGoBackendConfig, getPythonBackendConfig, setSettingsStore } from '../config/backendConfig';
import { logger, createLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

const lifecycleLogger = createLogger('AppLifecycle');

/**
 * 应用生命周期管理器
 */
export class AppLifecycle {
  private windowManager: WindowManager;
  private serviceManager: BackendServiceManager;
  private ipcHandler: IpcHandler;
  private conversationManager: ConversationManager;
  private isShuttingDown = false;

  constructor(
    windowManager: WindowManager,
    serviceManager: BackendServiceManager,
    ipcHandler: IpcHandler,
    conversationManager: ConversationManager
  ) {
    this.windowManager = windowManager;
    this.serviceManager = serviceManager;
    this.ipcHandler = ipcHandler;
    this.conversationManager = conversationManager;
  }

  /**
   * 初始化应用
   */
  async initialize(): Promise<void> {
    try {
      lifecycleLogger.info('Initializing application');

      // 初始化配置
      await configManager.initialize();

      // 创建后端服务
      await this.setupBackendServices();

      // 创建窗口
      await this.windowManager.createMainWindow();

      // 注册 IPC 处理器
      this.ipcHandler.register();
      this.ipcHandler.registerEventListeners(this.windowManager.getMainWindow());

      // 设置对话管理器
      await this.setupConversationManager();

      // 注册应用事件
      this.registerAppEvents();

      lifecycleLogger.info('Application initialized');
    } catch (error) {
      lifecycleLogger.error('Failed to initialize application', error);
      const appError = ErrorHandler.handleError(error, 'app:initialize');
      dialog.showErrorBox('启动失败', ErrorHandler.getUserFriendlyMessage(appError));
      app.quit();
    }
  }

  /**
   * 设置后端服务
   */
  private async setupBackendServices(): Promise<void> {
    lifecycleLogger.info('Setting up backend services');

    // 创建 Go 后端服务
    const goConfig = getGoBackendConfig();
    const goService = this.serviceManager.createGoBackendService(goConfig);

    // 创建 Python 后端服务
    // 注意：即使没有 API Key 也启动 Python 后端，以便 WebSocket 端点可用
    // Python 后端会在实际调用 LLM 时检查 API Key 并返回友好错误
    const pythonConfig = await getPythonBackendConfig();
    const pythonService = this.serviceManager.createPythonBackendService(pythonConfig);

    // 监听 Python 后端启动事件
    if (pythonConfig.apiKey) {
      pythonService.on('started', () => {
        const wsUrl = pythonService.getWsUrl();
        if (wsUrl) {
          this.conversationManager.refreshLlmClient(wsUrl);
        }
      });
    } else {
      lifecycleLogger.warn('Python backend will start without API Key. LLM features will be unavailable.');
    }

    // 启动所有服务
    try {
      // 先启动 Go 后端，获取 URL
      await this.serviceManager.startService('go-backend');
      lifecycleLogger.info('Go backend started');
      
      // 获取 Go 后端 URL
      if (goService.isRunning()) {
        const baseUrl = goService.getBaseUrl();
        if (baseUrl) {
          this.conversationManager.setBackendBaseUrl(baseUrl);
          // 设置环境变量供 Python 后端使用（在启动前设置）
          process.env.MCP_SERVER_URL = baseUrl;
        }
      }
      
      // 然后启动 Python 后端（此时 MCP_SERVER_URL 已设置）
      // 即使没有 API Key 也启动，以便 WebSocket 端点可用
      await this.serviceManager.startService('python-backend');
      lifecycleLogger.info('Python backend started');
      
      lifecycleLogger.info('All backend services started');
    } catch (error) {
      lifecycleLogger.error('Failed to start backend services', error);
      // 不阻止应用启动，但记录错误
    }
  }

  /**
   * 设置对话管理器
   */
  private async setupConversationManager(): Promise<void> {
    await this.conversationManager.refreshLlmClient();
  }

  /**
   * 注册应用事件
   */
  private registerAppEvents(): void {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', async (event) => {
      if (this.isShuttingDown) {
        return;
      }

      event.preventDefault();
      await this.shutdown();
    });

    app.on('activate', async () => {
      if (!this.windowManager.hasWindow()) {
        await this.windowManager.createMainWindow();
        this.ipcHandler.registerEventListeners(this.windowManager.getMainWindow());
      }
    });
  }

  /**
   * 关闭应用
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    lifecycleLogger.info('Shutting down application');

    try {
      // 停止所有后端服务
      await this.serviceManager.stopAll();
      lifecycleLogger.info('All backend services stopped');

      // 关闭窗口
      this.windowManager.closeMainWindow();

      app.exit();
    } catch (error) {
      lifecycleLogger.error('Error during shutdown', error);
      app.exit(1);
    }
  }
}

