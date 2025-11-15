import { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * 后端服务状态
 */
export enum BackendServiceStatus {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Error = 'error'
}

/**
 * 后端服务配置
 */
export interface BackendServiceConfig {
  name: string;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
  startupTimeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * 后端服务信息
 */
export interface BackendServiceInfo {
  name: string;
  status: BackendServiceStatus;
  process?: ChildProcessWithoutNullStreams;
  pid?: number;
  startTime?: number;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * 后端服务事件
 */
export interface BackendServiceEvents {
  status: (info: BackendServiceInfo) => void;
  error: (error: Error, info: BackendServiceInfo) => void;
  started: (info: BackendServiceInfo) => void;
  stopped: (info: BackendServiceInfo) => void;
}

