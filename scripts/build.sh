#!/bin/bash

# 构建脚本

set -e

echo "🔨 开始构建..."

# 进入 Electron 目录
cd "$(dirname "$0")/../desktop/electron" || exit 1

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi

# 构建 Go 后端
echo "🔨 构建 Go 后端..."
npm run build:go

# 构建 Electron 应用
echo "🔨 构建 Electron 应用..."
npm run build:main
npm run build:renderer

# 打包应用
echo "📦 打包应用..."
npm run package

echo "✅ 构建完成！输出目录: release/"

