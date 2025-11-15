import { app } from 'electron';
import path from 'path';

/**
 * 路径工具函数
 */

/**
 * 获取渲染进程构建目录路径
 */
export function getRendererDistPath(): string {
  return path.join(__dirname, '..', 'renderer');
}

/**
 * 获取预加载脚本路径
 */
export function getPreloadPath(): string {
  return path.join(__dirname, '..', 'preload.js');
}

/**
 * 获取 Go 可执行文件路径
 */
export function getGoExecutablePath(): string | null {
  const executableName =
    process.platform === 'win32' ? 'xiaohongshu-mcp.exe' : 'xiaohongshu-mcp';

  // 检查环境变量
  const envExecutable = process.env.MCP_SERVER_BIN;
  if (envExecutable && require('fs').existsSync(envExecutable)) {
    return envExecutable;
  }

  // 打包后的路径
  if (app.isPackaged) {
    const packaged = path.join(process.resourcesPath, 'bin', executableName);
    if (require('fs').existsSync(packaged)) {
      return packaged;
    }
  }

  // 开发环境路径
  const local = path.resolve(__dirname, '..', '..', '..', 'backend', 'go', executableName);
  if (require('fs').existsSync(local)) {
    return local;
  }

  return null;
}

/**
 * 获取 Python 可执行文件路径
 */
export function getPythonExecutablePath(): string | null {
  // 检查环境变量
  const envPython = process.env.PYTHON_BIN || process.env.PYTHON;
  if (envPython && require('fs').existsSync(envPython)) {
    return envPython;
  }

  // 打包后的 Python 可执行文件
  if (app.isPackaged) {
    const packaged = path.join(process.resourcesPath, 'backend', 'python', 'llm-backend');
    if (require('fs').existsSync(packaged)) {
      return packaged;
    }
    const packagedWin = path.join(
      process.resourcesPath,
      'backend',
      'python',
      'llm-backend.exe'
    );
    if (require('fs').existsSync(packagedWin)) {
      return packagedWin;
    }
  }

  // 开发环境：尝试系统 Python
  const pythonCommands = ['python3', 'python'];
  for (const cmd of pythonCommands) {
    try {
      const { execSync } = require('child_process');
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {
      // 继续尝试下一个
    }
  }

  return null;
}

/**
 * 获取 Python 后端目录路径
 */
export function getPythonBackendPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'python');
  }
  return path.resolve(__dirname, '..', '..', '..', 'backend', 'python');
}

/**
 * 获取 Go 后端目录路径
 */
export function getGoBackendPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'go');
  }
  return path.resolve(__dirname, '..', '..', '..', 'backend', 'go');
}

