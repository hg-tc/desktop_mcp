#!/bin/bash

# 开发环境启动脚本

set -e

echo "🚀 启动开发环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "⚠️  未找到 Python，Python 后端可能无法启动"
fi

# 检查 Go（可选）
if ! command -v go &> /dev/null; then
    echo "⚠️  未找到 Go，Go 后端将使用已编译的可执行文件"
fi

# 进入 Electron 目录
cd "$(dirname "$0")/../desktop/electron" || exit 1

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi

# 检查 Python 依赖
if [ ! -d "../../backend/python/venv" ] && [ -f "../../backend/python/requirements.txt" ]; then
    echo "📦 安装 Python 依赖..."
    cd ../../backend/python || exit 1
    python3 -m venv venv || python -m venv venv
    source venv/bin/activate || . venv/bin/activate
    pip install -r requirements.txt
    cd ../../../desktop/electron || exit 1
fi

# 启动开发服务器
echo "🎯 启动开发服务器..."
npm run dev

