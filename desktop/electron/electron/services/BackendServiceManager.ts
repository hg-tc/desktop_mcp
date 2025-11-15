import { EventEmitter } from 'events';
import log from 'electron-log';
import { BaseBackendService } from './BaseBackendService';
import { BackendServiceInfo, BackendServiceStatus } from './types';
import { GoBackendService, GoBackendServiceOptions } from './GoBackendService';
import { PythonBackendService, PythonBackendServiceOptions } from './PythonBackendService';

/**
 * 后端服务管理器
 * 统一管理所有后端服务的生命周期
 */
export class BackendServiceManager extends EventEmitter {
  private services: Map<string, BaseBackendService> = new Map();
  private isShuttingDown = false;

  /**
   * 注册服务
   */
  registerService(service: BaseBackendService): void {
    const info = service.getInfo();
    this.services.set(info.name, service);

    // 监听服务事件
    service.on('status', (serviceInfo) => {
      this.emit('service:status', serviceInfo);
    });

    service.on('error', (error, serviceInfo) => {
      log.error(`[ServiceManager] Service ${info.name} error:`, error);
      this.emit('service:error', error, serviceInfo);
    });

    service.on('started', (serviceInfo) => {
      log.info(`[ServiceManager] Service ${info.name} started`);
      this.emit('service:started', serviceInfo);
    });

    service.on('stopped', (serviceInfo) => {
      log.info(`[ServiceManager] Service ${info.name} stopped`);
      this.emit('service:stopped', serviceInfo);
    });
  }

  /**
   * 获取服务
   */
  getService(name: string): BaseBackendService | undefined {
    return this.services.get(name);
  }

  /**
   * 获取所有服务信息
   */
  getAllServicesInfo(): BackendServiceInfo[] {
    return Array.from(this.services.values()).map((service) => service.getInfo());
  }

  /**
   * 启动所有服务（并行）
   */
  async startAll(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot start services during shutdown');
    }

    const services = Array.from(this.services.values());
    log.info(`[ServiceManager] Starting ${services.length} services in parallel`);

    const startPromises = services.map(async (service) => {
      try {
        await service.start();
      } catch (error) {
        log.error(`[ServiceManager] Failed to start service ${service.getInfo().name}:`, error);
        throw error;
      }
    });

    await Promise.all(startPromises);
    log.info('[ServiceManager] All services started');
  }

  /**
   * 启动指定服务
   */
  async startService(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    await service.start();
  }

  /**
   * 停止所有服务（并行）
   */
  async stopAll(): Promise<void> {
    this.isShuttingDown = true;

    const services = Array.from(this.services.values());
    log.info(`[ServiceManager] Stopping ${services.length} services`);

    const stopPromises = services.map(async (service) => {
      try {
        await service.stop();
      } catch (error) {
        log.error(`[ServiceManager] Failed to stop service ${service.getInfo().name}:`, error);
      }
    });

    await Promise.all(stopPromises);
    log.info('[ServiceManager] All services stopped');
    this.isShuttingDown = false;
  }

  /**
   * 停止指定服务
   */
  async stopService(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    await service.stop();
  }

  /**
   * 重启所有服务
   */
  async restartAll(): Promise<void> {
    await this.stopAll();
    await this.startAll();
  }

  /**
   * 重启指定服务
   */
  async restartService(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    await service.restart();
  }

  /**
   * 检查所有服务是否运行中
   */
  areAllServicesRunning(): boolean {
    return Array.from(this.services.values()).every((service) => service.isRunning());
  }

  /**
   * 创建 Go 后端服务
   */
  createGoBackendService(options: GoBackendServiceOptions): GoBackendService {
    const service = new GoBackendService(
      {
        name: 'go-backend',
        healthCheckInterval: 5000,
        startupTimeout: 30_000
      },
      options
    );
    this.registerService(service);
    return service;
  }

  /**
   * 创建 Python 后端服务
   */
  createPythonBackendService(options: PythonBackendServiceOptions): PythonBackendService {
    const service = new PythonBackendService(
      {
        name: 'python-backend',
        healthCheckUrl: `http://127.0.0.1:${options.port ?? 18061}/health`,
        healthCheckInterval: 5000,
        startupTimeout: 30_000
      },
      options
    );
    this.registerService(service);
    return service;
  }
}

