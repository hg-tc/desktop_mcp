import { ipcMain } from 'electron';
import { IpcChannel } from '../types';
import { BackendServiceManager } from '../../services/BackendServiceManager';
import { GoBackendService } from '../../services/GoBackendService';
import { PythonBackendService } from '../../services/PythonBackendService';
import { ErrorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import type { BackendInfo } from '../../types';

/**
 * 后端 IPC 处理器
 */
export class BackendHandler {
  constructor(private readonly serviceManager: BackendServiceManager) {}

  /**
   * 注册所有后端相关的 IPC 处理器
   */
  register(): void {
    ipcMain.handle(IpcChannel.BackendGetInfo, async (): Promise<BackendInfo> => {
      try {
        const goService = this.serviceManager.getService('go-backend');
        const pythonService = this.serviceManager.getService('python-backend');

        if (!goService || !goService.isRunning()) {
          throw new Error('Go backend is not running');
        }

        const goServiceTyped = goService as GoBackendService;
        const pythonServiceTyped = pythonService as PythonBackendService | undefined;

        const info: BackendInfo = {
          baseUrl: goServiceTyped.getBaseUrl(),
          cookiesPath: goServiceTyped.getCookiesPath(),
          addr: goServiceTyped.getAddress()
        };

        if (pythonServiceTyped && pythonServiceTyped.isRunning()) {
          info.wsUrl = pythonServiceTyped.getWsUrl();
          info.port = pythonServiceTyped.getPort();
        }

        return info;
      } catch (error) {
        logger.error('Failed to get backend info', error);
        throw ErrorHandler.handleError(error, 'backend:get-info');
      }
    });

    ipcMain.handle(IpcChannel.BackendGetStatus, async () => {
      try {
        const goService = this.serviceManager.getService('go-backend');
        const pythonService = this.serviceManager.getService('python-backend');

        // 检查 Python 后端是否有 API Key
        // 通过检查配置来获取 API Key 状态
        const { getPythonBackendConfig } = await import('../../config/backendConfig');
        const pythonConfig = await getPythonBackendConfig();
        const hasApiKey = !!pythonConfig.apiKey;
        
        return {
          go: {
            exists: !!goService,
            running: goService?.isRunning() ?? false,
            status: goService?.getInfo().status ?? 'unknown'
          },
          python: {
            exists: !!pythonService,
            running: pythonService?.isRunning() ?? false,
            status: pythonService?.getInfo().status ?? 'unknown',
            reason: !pythonService ? 'not_created' : 
                    !hasApiKey ? 'no_api_key' :
                    pythonService.isRunning() ? 'running' : 'not_running'
          }
        };
      } catch (error) {
        logger.error('Failed to get backend status', error);
        return {
          go: { exists: false, running: false, status: 'error' },
          python: { exists: false, running: false, status: 'error', reason: 'error' }
        };
      }
    });
  }
}

