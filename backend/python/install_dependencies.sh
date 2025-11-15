#!/bin/bash
# Python 后端依赖安装脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 安装 Python 后端依赖..."
echo "Python 版本: $(python3 --version)"
echo "工作目录: $SCRIPT_DIR"

# 检查 requirements.txt 是否存在
if [ ! -f "requirements.txt" ]; then
    echo "❌ 错误: requirements.txt 不存在"
    exit 1
fi

# 安装依赖
echo "正在安装依赖包..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

echo "✅ 依赖安装完成！"
echo ""
echo "已安装的主要包："
python3 -m pip list | grep -E "(fastapi|uvicorn|openai|sqlalchemy|pydantic)" || true


