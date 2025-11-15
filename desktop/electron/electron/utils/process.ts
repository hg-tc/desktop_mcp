import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from './logger';

/**
 * 进程工具函数
 */

/**
 * 终止进程（跨平台）
 */
export async function killProcess(
  process: ChildProcessWithoutNullStreams,
  timeout: number = 10_000
): Promise<void> {
  return new Promise<void>((resolve) => {
    const onExit = () => resolve();
    process.once('exit', onExit);

    if (process.exitCode !== null || process.killed) {
      process.removeListener('exit', onExit);
      resolve();
      return;
    }

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', `${process.pid}`, '/f', '/t']);
    } else {
      process.kill('SIGTERM');
    }

    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    }, timeout).unref();
  });
}

/**
 * 等待进程输出特定内容
 */
export function waitForProcessOutput(
  process: ChildProcessWithoutNullStreams,
  pattern: RegExp | string,
  timeout: number = 30_000
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let matched = false;

    const timeoutId = setTimeout(() => {
      if (!matched) {
        cleanup();
        reject(new Error(`Process output timeout: ${pattern}`));
      }
    }, timeout);

    const handleData = (data: Buffer | string) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      for (const line of lines) {
        if (regex.test(line)) {
          matched = true;
          cleanup();
          resolve(line);
          return;
        }
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      process.stdout.removeListener('data', handleData);
      process.stderr.removeListener('data', handleData);
      process.removeListener('exit', onExit);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (!matched) {
        cleanup();
        reject(
          new Error(`Process exited before matching pattern (code=${code}, signal=${signal})`)
        );
      }
    };

    process.stdout.on('data', handleData);
    process.stderr.on('data', handleData);
    process.on('exit', onExit);
  });
}

/**
 * 检查进程是否运行中
 */
export function isProcessRunning(process: ChildProcessWithoutNullStreams): boolean {
  return process.exitCode === null && !process.killed;
}

