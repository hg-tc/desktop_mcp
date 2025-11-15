/**
 * 后端相关类型定义
 */

import { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * 后端服务状态
 */
export enum BackendStatus {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Error = 'error'
}

/**
 * Go 后端状态
 */
export interface GoBackendState {
  process: ChildProcessWithoutNullStreams;
  addr: string;
  baseUrl: string;
  cookiesPath: string;
}

/**
 * Python 后端状态
 */
export interface PythonBackendState {
  process: ChildProcessWithoutNullStreams;
  wsUrl: string;
  port: number;
}

/**
 * 后端信息
 */
export interface BackendInfo {
  baseUrl: string;
  cookiesPath?: string;
  addr?: string;
  wsUrl?: string;
  port?: number;
}

