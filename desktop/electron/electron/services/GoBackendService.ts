import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { BaseBackendService } from './BaseBackendService';
import { BackendServiceConfig } from './types';

export interface GoBackendServiceOptions {
  executablePath?: string;
  workingDirectory?: string;
  port?: string;
  browserBin?: string;
  cookiesPath?: string;
}

export class GoBackendService extends BaseBackendService {
  private options: GoBackendServiceOptions;
  private address: string = '';
  private baseUrl: string = '';

  constructor(config: BackendServiceConfig, options: GoBackendServiceOptions) {
    super({
      ...config,
      healthCheckInterval: 5000 // Go 后端健康检查间隔
    });
    this.options = options;
  }

  getAddress(): string {
    return this.address;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getCookiesPath(): string {
    return this.options.cookiesPath ?? '';
  }

  protected async spawnProcess(): Promise<ChildProcessWithoutNullStreams> {
    const executableName =
      process.platform === 'win32' ? 'xiaohongshu-mcp.exe' : 'xiaohongshu-mcp';

    // 获取可执行文件路径
    let executable = this.options.executablePath;
    if (!executable) {
      const envExecutable = process.env.MCP_SERVER_BIN;
      if (envExecutable && fs.existsSync(envExecutable)) {
        executable = envExecutable;
      } else if (app.isPackaged) {
        const packaged = path.join(process.resourcesPath, 'bin', executableName);
        if (fs.existsSync(packaged)) {
          executable = packaged;
        }
      } else {
        const local = path.resolve(__dirname, '..', '..', '..', 'backend', 'go', executableName);
        if (fs.existsSync(local)) {
          executable = local;
        }
      }
    }

    // 确定工作目录
    let cwd = this.options.workingDirectory;
    if (!cwd) {
      if (executable) {
        cwd = path.dirname(executable);
      } else {
        cwd = path.resolve(__dirname, '..', '..', '..', 'backend', 'go');
      }
    }

    // 准备命令和参数
    const command = executable ?? 'go';
    const args: string[] = [];

    if (executable && !executable.endsWith('.exe') && !executable.includes('go')) {
      // 可执行文件
      args.push('--desktop');
      if (this.options.browserBin) {
        args.push('--bin', this.options.browserBin);
      }
    } else {
      // 开发环境：使用 go run
      args.push('run', '.', '--desktop');
      if (this.options.browserBin) {
        args.push('--bin', this.options.browserBin);
      }
    }

    const requestedPort = this.options.port ?? process.env.MCP_SERVER_PORT ?? '0';
    args.push('--port', requestedPort);

    // 准备环境变量
    const env = {
      ...process.env,
      COOKIES_PATH: this.options.cookiesPath ?? path.join(app.getPath('userData'), 'cookies', 'cookies.json')
    };

    if (!env.ROD_BROWSER_BIN && this.options.browserBin) {
      env.ROD_BROWSER_BIN = this.options.browserBin;
    }

    log.info(`[GoBackend] Launching: ${command} ${args.join(' ')} (cwd: ${cwd})`);

    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // 处理输出
    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        log.info('[GoBackend]', line);
      });
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        log.error('[GoBackend]', line);
      });
    });

    return child;
  }

  protected async waitForReady(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.process) {
        reject(new Error('Process not spawned'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Go backend startup timeout'));
        if (this.process) {
          this.process.kill();
        }
      }, this.config.startupTimeout ?? 30_000);

      const handleData = (data: Buffer | string) => {
        const text = data.toString();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('APP_SERVER_ADDR=')) {
            this.address = line.replace('APP_SERVER_ADDR=', '').trim();
            this.baseUrl = this.buildBaseUrl(this.address);
            clearTimeout(timeout);
            resolve();
            return;
          }
        }
      };

      this.process.stdout.on('data', handleData);

      this.process.on('exit', (code, signal) => {
        clearTimeout(timeout);
        reject(
          new Error(`Go backend process exited prematurely (code=${code}, signal=${signal})`)
        );
      });
    });
  }

  protected async performHealthCheck(): Promise<boolean> {
    if (!this.baseUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  protected async killProcess(process: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise<void>((resolve) => {
      const onExit = () => resolve();
      process.once('exit', onExit);

      if (process.exitCode !== null || process.killed) {
        process.removeListener('exit', onExit);
        resolve();
        return;
      }

      if (process.platform === 'win32') {
        const { spawn: spawnKill } = require('child_process');
        spawnKill('taskkill', ['/pid', `${process.pid}`, '/f', '/t']);
      } else {
        process.kill('SIGTERM');
      }

      setTimeout(() => {
        process.kill('SIGKILL');
      }, 10_000).unref();
    });
  }

  private buildBaseUrl(addr: string): string {
    // 处理 IPv6 地址格式 [::]:port 或 [::1]:port
    if (addr.startsWith('[')) {
      const match = addr.match(/^\[([^\]]+)\]:(\d+)$/);
      if (match) {
        const [, host, port] = match;
        if (host === '::' || host === '::1' || !host) {
          return `http://127.0.0.1:${port}`;
        }
        return `http://[${host}]:${port}`;
      }
    }

    // 处理 IPv4 地址格式 host:port
    const lastColonIndex = addr.lastIndexOf(':');
    if (lastColonIndex === -1) {
      return `http://127.0.0.1:18060`;
    }

    const hostPart = addr.substring(0, lastColonIndex);
    const portPart = addr.substring(lastColonIndex + 1);

    let host = hostPart.trim();
    if (!host || host === '0.0.0.0' || host === '::') {
      host = '127.0.0.1';
    }

    const port = portPart.trim();
    if (!port || isNaN(Number(port))) {
      return `http://127.0.0.1:18060`;
    }

    return `http://${host}:${port}`;
  }
}

