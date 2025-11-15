#!/usr/bin/env node

/**
 * 构建 Python 后端环境
 * 方案1: 创建独立的 Python 虚拟环境并打包（推荐）
 * 方案2: 使用 PyInstaller 打包成可执行文件（备选）
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const pythonBackendDir = path.join(repoRoot, 'backend', 'python');
const outputDir = path.resolve(__dirname, '..', 'dist', 'python-backend');

// 确保输出目录存在
fs.mkdirSync(outputDir, { recursive: true });

console.log('🔨 开始构建 Python 后端环境...');
console.log(`📁 Python 后端目录: ${pythonBackendDir}`);
console.log(`📦 输出目录: ${outputDir}`);

// 方案选择：优先使用虚拟环境方案
const useVenv = process.env.PYTHON_BUILD_METHOD !== 'pyinstaller';

if (useVenv) {
  console.log('📦 使用虚拟环境方案...');
  
  // 创建虚拟环境
  const venvPath = path.join(outputDir, 'venv');
  console.log(`🔧 创建虚拟环境: ${venvPath}`);
  
  const venvResult = spawnSync('python3', ['-m', 'venv', venvPath], {
    stdio: 'inherit',
    cwd: pythonBackendDir
  });
  
  if (venvResult.status !== 0) {
    console.error('❌ 创建虚拟环境失败');
    process.exit(1);
  }
  
  // 确定 Python 可执行文件路径
  const pythonBin = process.platform === 'win32' 
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python');
  
  // 升级 pip
  console.log('⬆️  升级 pip...');
  spawnSync(pythonBin, ['-m', 'pip', 'install', '--upgrade', 'pip'], {
    stdio: 'inherit',
    cwd: pythonBackendDir
  });
  
  // 安装依赖
  console.log('📥 安装 Python 依赖...');
  const installResult = spawnSync(pythonBin, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
    stdio: 'inherit',
    cwd: pythonBackendDir
  });
  
  if (installResult.status !== 0) {
    console.error('❌ 安装 Python 依赖失败');
    process.exit(1);
  }
  
  // 复制 Python 源代码
  console.log('📋 复制 Python 源代码...');
  const copySource = (src, dest) => {
    if (!fs.existsSync(src)) return;
    
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const files = fs.readdirSync(src);
      files.forEach(file => {
        if (file !== '__pycache__' && file !== '.pyc' && file !== 'venv') {
          copySource(path.join(src, file), path.join(dest, file));
        }
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };
  
  // 复制 app 目录
  const appSrc = path.join(pythonBackendDir, 'app');
  const appDest = path.join(outputDir, 'app');
  if (fs.existsSync(appSrc)) {
    copySource(appSrc, appDest);
  }
  
  // 复制其他必要文件
  const filesToCopy = ['.env', 'requirements.txt'];
  filesToCopy.forEach(file => {
    const src = path.join(pythonBackendDir, file);
    const dest = path.join(outputDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  });
  
  // 创建启动脚本
  const startScript = process.platform === 'win32'
    ? `@echo off\n"${pythonBin}" -m uvicorn app.main:app --host 127.0.0.1 --port 18061\n`
    : `#!/bin/bash\n"${pythonBin}" -m uvicorn app.main:app --host 127.0.0.1 --port 18061\n`;
  
  const scriptName = process.platform === 'win32' ? 'start.bat' : 'start.sh';
  const scriptPath = path.join(outputDir, scriptName);
  fs.writeFileSync(scriptPath, startScript);
  
  if (process.platform !== 'win32') {
    fs.chmodSync(scriptPath, '755');
  }
  
  // 保存 Python 可执行文件路径信息
  const pythonInfo = {
    executable: pythonBin,
    venvPath: venvPath,
    backendPath: outputDir
  };
  fs.writeFileSync(
    path.join(outputDir, 'python-info.json'),
    JSON.stringify(pythonInfo, null, 2)
  );
  
  console.log('✅ 虚拟环境构建完成！');
  console.log(`📝 Python 可执行文件: ${pythonBin}`);
  console.log(`📝 启动脚本: ${scriptPath}`);
  
} else {
  // 备选方案：使用 PyInstaller
  console.log('📦 使用 PyInstaller 方案...');
  console.warn('⚠️  PyInstaller 方案会生成较大的可执行文件，建议使用虚拟环境方案');
  
  // 检查 PyInstaller
  try {
    execSync('pyinstaller --version', { stdio: 'ignore' });
  } catch {
    console.log('📥 安装 PyInstaller...');
    spawnSync('pip3', ['install', 'pyinstaller'], { stdio: 'inherit' });
  }
  
  // 使用 PyInstaller 打包（这里简化，实际需要更复杂的配置）
  console.log('⚠️  PyInstaller 方案需要更详细的配置，建议使用虚拟环境方案');
  process.exit(1);
}

console.log('✨ Python 后端构建完成！');

