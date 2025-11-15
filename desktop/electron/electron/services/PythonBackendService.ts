import { spawn, ChildProcessWithoutNullStreams, exec } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import log from 'electron-log';
import { BaseBackendService } from './BaseBackendService';
import { BackendServiceConfig } from './types';

const execAsync = promisify(exec);

export interface PythonBackendServiceOptions {
  executablePath?: string;
  workingDirectory?: string;
  port?: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  headers?: Record<string, string>;
}

export class PythonBackendService extends BaseBackendService {
  private options: PythonBackendServiceOptions;
  private wsUrl: string = '';

  constructor(config: BackendServiceConfig, options: PythonBackendServiceOptions) {
    super({
      ...config,
      healthCheckUrl: `http://127.0.0.1:${options.port ?? 18061}/health`,
      healthCheckInterval: 5000
    });
    this.options = options;
    this.wsUrl = `ws://127.0.0.1:${options.port ?? 18061}/ws`;
  }

  getWsUrl(): string {
    return this.wsUrl;
  }

  getPort(): number {
    return this.options.port ?? 18061;
  }

  protected async spawnProcess(): Promise<ChildProcessWithoutNullStreams> {
    // 获取 Python 可执行文件
    let pythonExecutable = this.options.executablePath;
    if (!pythonExecutable) {
      const envPython = process.env.PYTHON_BIN || process.env.PYTHON;
      if (envPython && fs.existsSync(envPython)) {
        pythonExecutable = envPython;
      } else if (app.isPackaged) {
        // 打包环境：优先使用虚拟环境中的 Python
        const pythonBackendPath = path.join(process.resourcesPath, 'backend', 'python');
        const pythonInfoPath = path.join(pythonBackendPath, 'python-info.json');
        
        if (fs.existsSync(pythonInfoPath)) {
          try {
            const pythonInfo = JSON.parse(fs.readFileSync(pythonInfoPath, 'utf-8'));
            // python-info.json 中的路径是构建时的绝对路径，需要转换为打包后的相对路径
            // 虚拟环境路径应该是相对于 pythonBackendPath 的
            const venvRelativePath = process.platform === 'win32' 
              ? path.join('venv', 'Scripts', 'python.exe')
              : path.join('venv', 'bin', 'python');
            const venvPython = path.join(pythonBackendPath, venvRelativePath);
            
            if (fs.existsSync(venvPython)) {
              pythonExecutable = venvPython;
              log.info(`[PythonBackend] 使用打包的虚拟环境 Python: ${pythonExecutable}`);
            } else {
              log.warn(`[PythonBackend] 虚拟环境 Python 不存在: ${venvPython}`);
            }
          } catch (error) {
            log.warn(`[PythonBackend] 读取 python-info.json 失败: ${error}`);
          }
        }
        
        // 如果没有虚拟环境，尝试查找打包的可执行文件（PyInstaller 方案）
        if (!pythonExecutable) {
          const packaged = path.join(pythonBackendPath, 'python-backend');
          if (fs.existsSync(packaged)) {
            pythonExecutable = packaged;
            log.info(`[PythonBackend] 使用 PyInstaller 打包的 Python: ${pythonExecutable}`);
          }
          const packagedWin = path.join(pythonBackendPath, 'python-backend.exe');
          if (fs.existsSync(packagedWin)) {
            pythonExecutable = packagedWin;
            log.info(`[PythonBackend] 使用 PyInstaller 打包的 Python: ${pythonExecutable}`);
          }
        }
      } else {
        // 开发环境：尝试系统 Python
        const pythonCommands = ['python3', 'python'];
        for (const cmd of pythonCommands) {
          try {
            const { execSync } = require('child_process');
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            pythonExecutable = cmd;
            break;
          } catch {
            // 继续尝试下一个
          }
        }
      }
    }

    if (!pythonExecutable) {
      throw new Error('未找到 Python 可执行文件，请确保已安装 Python 3.10+');
    }

    // 获取后端路径
    let backendPath = this.options.workingDirectory;
    if (!backendPath) {
      if (app.isPackaged) {
        backendPath = path.join(process.resourcesPath, 'backend', 'python');
      } else {
        backendPath = path.resolve(__dirname, '..', '..', '..', 'backend', 'python');
      }
    }

    // 优先使用 app/main.py（新的应用系统入口）
    const appMainPyPath = path.join(backendPath, 'app', 'main.py');
    const mainPyPath = path.join(backendPath, 'main.py');

    // 检查入口文件是否存在
    let entryPoint: string;
    if (fs.existsSync(appMainPyPath)) {
      entryPoint = appMainPyPath;
    } else if (fs.existsSync(mainPyPath)) {
      entryPoint = mainPyPath;
    } else if (pythonExecutable.endsWith('llm-backend') || pythonExecutable.endsWith('llm-backend.exe')) {
      // 打包后的可执行文件
      entryPoint = '';
    } else {
      throw new Error(`Python 后端入口文件不存在: ${appMainPyPath} 或 ${mainPyPath}`);
    }

    // 准备命令和参数
    let command = pythonExecutable;
    let args: string[] = [];
    let cwd = backendPath;

    // 如果是打包后的可执行文件，直接运行
    if (pythonExecutable.endsWith('llm-backend') || pythonExecutable.endsWith('llm-backend.exe')) {
      command = pythonExecutable;
      args = [];
      cwd = path.dirname(pythonExecutable);
    } else {
      // 开发环境：运行入口文件
      args = [entryPoint];
    }

    // 准备环境变量
    const env: Record<string, string> = {
      ...process.env,
      LLM_WS_PORT: String(this.options.port ?? 18061),
      LOG_LEVEL: process.env.NODE_ENV !== 'production' ? 'DEBUG' : 'INFO',
      USER_DATA_PATH: app.getPath('userData'), // 传递应用数据目录路径
    };

    // 传递 Go 后端 URL（如果已设置）
    if (process.env.MCP_SERVER_URL) {
      env.MCP_SERVER_URL = process.env.MCP_SERVER_URL;
    }

    // 传递 API Key（如果 Electron 有配置）
    // 注意：即使不传递，Python 后端也会从 .env 文件读取
    if (this.options.apiKey) {
      env.OPENAI_API_KEY = this.options.apiKey;
      log.info('[PythonBackend] API Key 已通过环境变量传递');
    } else {
      log.info('[PythonBackend] API Key 未通过环境变量传递，Python 后端将从 .env 文件读取');
    }
    const defaultBaseUrl = 'https://api.openai.com/v1';
    const baseUrlFromOptions = this.options.baseUrl?.trim();
    if (baseUrlFromOptions && baseUrlFromOptions !== defaultBaseUrl) {
      env.OPENAI_BASE_URL = baseUrlFromOptions;
      log.info(`[PythonBackend] Base URL 通过 Electron 传递: ${baseUrlFromOptions}`);
    } else if (baseUrlFromOptions) {
      log.info('[PythonBackend] Base URL 等于默认值，保持由 Python (.env) 决定');
    }

    const defaultModel = 'gpt-4o-mini';
    const modelFromOptions = this.options.model?.trim();
    if (modelFromOptions && modelFromOptions !== defaultModel) {
      env.OPENAI_MODEL = modelFromOptions;
      log.info(`[PythonBackend] Model 通过 Electron 传递: ${modelFromOptions}`);
    } else if (modelFromOptions) {
      log.info('[PythonBackend] Model 等于默认值，保持由 Python (.env) 决定');
    }
    if (this.options.headers) {
      env.OPENAI_HEADERS = JSON.stringify(this.options.headers);
    }

    log.info(`[PythonBackend] Launching: ${command} ${args.join(' ')} (cwd: ${cwd})`);
    console.log(`[🐍 PythonBackend] 启动命令: ${command} ${args.join(' ')}`);
    console.log(`[🐍 PythonBackend] 工作目录: ${cwd}`);
    console.log(`[🐍 PythonBackend] API Key (Electron传递): ${this.options.apiKey ? '已设置' : '未设置'}`);
    console.log(`[🐍 PythonBackend] 提示: 如果 Electron 未传递 API Key，Python 后端会从 .env 文件读取`);

    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // 立即输出启动信息
    console.log(`[🐍 PythonBackend] 进程已启动，PID: ${child.pid}`);

    // 处理输出 - 确保所有输出都被记录
    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      // 不过滤空行，保留所有输出以便调试
      const lines = text.split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          // 使用更明显的标记
          console.log('[🐍 PythonBackend STDOUT]', trimmed);
          log.info('[PythonBackend]', trimmed);
        }
      });
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/);
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          // 使用更明显的标记
          console.error('[🐍 PythonBackend STDERR]', trimmed);
          log.error('[PythonBackend]', trimmed);
          
          // 检测端口占用错误
          if (trimmed.includes('address already in use') || trimmed.includes('Errno 48')) {
            const port = this.options.port ?? 18061;
            log.error(`[PythonBackend] ⚠️ 端口 ${port} 已被占用！`);
            log.error(`[PythonBackend] 提示: 请关闭占用该端口的进程，或重启应用`);
            // 尝试查找并提示占用端口的进程
            this.detectPortConflict(port);
          }
        }
      });
    });
    
    // 监听进程退出事件
    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        log.error(`[PythonBackend] 进程异常退出: code=${code}, signal=${signal}`);
      }
    });

    return child;
  }

  protected async waitForReady(): Promise<void> {
    const healthUrl = this.config.healthCheckUrl;
    if (!healthUrl) {
      // 如果没有健康检查 URL，等待 2 秒后认为就绪
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python backend startup timeout'));
        if (this.process) {
          this.process.kill();
        }
      }, this.config.startupTimeout ?? 30_000);

      const checkHealth = async () => {
        try {
          const response = await fetch(healthUrl);
          if (response.ok) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkHealth, 1000);
          }
        } catch {
          setTimeout(checkHealth, 1000);
        }
      };

      // 等待 2 秒后开始检查
      setTimeout(checkHealth, 2000);
    });
  }

  /**
   * 检测端口冲突
   */
  private async detectPortConflict(port: number): Promise<void> {
    try {
      // macOS/Linux 使用 lsof
      const { stdout } = await execAsync(`lsof -ti :${port}`);
      const pid = stdout.trim();
      if (pid) {
        log.warn(`[PythonBackend] 发现占用端口 ${port} 的进程 PID: ${pid}`);
        log.warn(`[PythonBackend] 可以运行以下命令关闭该进程: kill -9 ${pid}`);
      }
    } catch (error) {
      // 如果命令失败，忽略（可能是没有找到进程）
    }
  }

  protected async performHealthCheck(): Promise<boolean> {
    const healthUrl = this.config.healthCheckUrl;
    if (!healthUrl) {
      return true;
    }

    try {
      const response = await fetch(healthUrl);
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
}

