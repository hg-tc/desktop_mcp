#!/bin/bash

# 环境设置脚本

set -e

echo "🔧 设置开发环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 Python
if command -v python3 &> /dev/null; then
    echo "✅ Python 版本: $(python3 --version)"
elif command -v python &> /dev/null; then
    echo "✅ Python 版本: $(python --version)"
else
    echo "⚠️  未找到 Python，请安装 Python 3.10+"
fi

# 检查 Go（可选）
if command -v go &> /dev/null; then
    echo "✅ Go 版本: $(go version)"
else
    echo "⚠️  未找到 Go，Go 后端将使用已编译的可执行文件"
fi

# 安装 Node.js 依赖
echo "📦 安装 Node.js 依赖..."
cd "$(dirname "$0")/../desktop/electron" || exit 1
npm install

# 安装 Python 依赖
if [ -f "../../backend/python/requirements.txt" ]; then
    echo "📦 安装 Python 依赖..."
    cd ../../backend/python || exit 1
    
    # 创建虚拟环境
    if [ ! -d "venv" ]; then
        python3 -m venv venv || python -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    source venv/bin/activate || . venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    echo "✅ Python 依赖安装完成"
fi

echo "✅ 环境设置完成！"

