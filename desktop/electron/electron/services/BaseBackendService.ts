import { EventEmitter } from 'events';
import { ChildProcessWithoutNullStreams } from 'child_process';
import {
  BackendServiceStatus,
  BackendServiceConfig,
  BackendServiceInfo,
  BackendServiceEvents
} from './types';

/**
 * 后端服务基类
 * 所有后端服务都应该继承此类
 */
export abstract class BaseBackendService extends EventEmitter {
  protected status: BackendServiceStatus = BackendServiceStatus.Stopped;
  protected process: ChildProcessWithoutNullStreams | null = null;
  protected config: BackendServiceConfig;
  protected startTime: number | null = null;
  protected error: Error | null = null;
  protected metadata: Record<string, unknown> = {};

  constructor(config: BackendServiceConfig) {
    super();
    this.config = {
      startupTimeout: 30_000,
      retryCount: 3,
      retryDelay: 1000,
      healthCheckInterval: 1000,
      ...config
    };
  }

  /**
   * 获取服务信息
   */
  getInfo(): BackendServiceInfo {
    return {
      name: this.config.name,
      status: this.status,
      process: this.process ?? undefined,
      pid: this.process?.pid,
      startTime: this.startTime ?? undefined,
      error: this.error ?? undefined,
      metadata: { ...this.metadata }
    };
  }

  /**
   * 获取服务状态
   */
  getStatus(): BackendServiceStatus {
    return this.status;
  }

  /**
   * 检查服务是否运行中
   */
  isRunning(): boolean {
    return this.status === BackendServiceStatus.Running;
  }

  /**
   * 启动服务
   */
  async start(): Promise<void> {
    if (this.status === BackendServiceStatus.Running) {
      return;
    }

    if (this.status === BackendServiceStatus.Starting) {
      throw new Error(`Service ${this.config.name} is already starting`);
    }

    this.status = BackendServiceStatus.Starting;
    this.error = null;
    this.emit('status', this.getInfo());

    try {
      // 启动进程
      this.process = await this.spawnProcess();
      this.startTime = Date.now();

      // 等待服务就绪
      await this.waitForReady();

      // 开始健康检查
      this.startHealthCheck();

      this.status = BackendServiceStatus.Running;
      this.emit('started', this.getInfo());
      this.emit('status', this.getInfo());
    } catch (error) {
      this.status = BackendServiceStatus.Error;
      this.error = error instanceof Error ? error : new Error(String(error));
      this.emit('error', this.error, this.getInfo());
      this.emit('status', this.getInfo());
      throw error;
    }
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    if (this.status === BackendServiceStatus.Stopped) {
      return;
    }

    if (this.status === BackendServiceStatus.Stopping) {
      return;
    }

    this.status = BackendServiceStatus.Stopping;
    this.emit('status', this.getInfo());

    try {
      this.stopHealthCheck();

      if (this.process) {
        await this.killProcess(this.process);
        this.process = null;
      }

      this.status = BackendServiceStatus.Stopped;
      this.startTime = null;
      this.error = null;
      this.emit('stopped', this.getInfo());
      this.emit('status', this.getInfo());
    } catch (error) {
      this.status = BackendServiceStatus.Error;
      this.error = error instanceof Error ? error : new Error(String(error));
      this.emit('error', this.error, this.getInfo());
      this.emit('status', this.getInfo());
      throw error;
    }
  }

  /**
   * 重启服务
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata: Record<string, unknown>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.emit('status', this.getInfo());
  }

  /**
   * 抽象方法：生成进程
   */
  protected abstract spawnProcess(): Promise<ChildProcessWithoutNullStreams>;

  /**
   * 抽象方法：等待服务就绪
   */
  protected abstract waitForReady(): Promise<void>;

  /**
   * 抽象方法：健康检查
   */
  protected abstract performHealthCheck(): Promise<boolean>;

  /**
   * 抽象方法：终止进程
   */
  protected abstract killProcess(process: ChildProcessWithoutNullStreams): Promise<void>;

  /**
   * 健康检查定时器
   */
  private healthCheckTimer: NodeJS.Timeout | null = null;

  /**
   * 开始健康检查
   */
  protected startHealthCheck(): void {
    if (!this.config.healthCheckUrl || !this.config.healthCheckInterval) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      if (this.status !== BackendServiceStatus.Running) {
        return;
      }

      try {
        const isHealthy = await this.performHealthCheck();
        if (!isHealthy) {
          this.status = BackendServiceStatus.Error;
          this.error = new Error('Health check failed');
          this.emit('error', this.error, this.getInfo());
          this.emit('status', this.getInfo());
        }
      } catch (error) {
        // 健康检查失败，但不改变状态，只记录错误
        this.error = error instanceof Error ? error : new Error(String(error));
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  protected stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

