# Python 升级指南

当前系统：macOS 15.6.1  
当前 Python 版本：3.9.6  
目标版本：Python 3.10+（LangChain 1.0 要求）

## 方案一：使用 Homebrew（推荐）

### 1. 安装 Homebrew（如果未安装）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. 安装 Python 3.12（最新稳定版）

```bash
brew install python@3.12
```

### 3. 验证安装

```bash
python3.12 --version
```

### 4. 创建符号链接（可选，让 python3 指向新版本）

```bash
# 备份旧版本
sudo mv /usr/bin/python3 /usr/bin/python3.9.backup

# 创建符号链接（需要管理员权限）
sudo ln -s /opt/homebrew/bin/python3.12 /usr/bin/python3
```

或者更安全的方式，修改 PATH：

```bash
# 在 ~/.zshrc 或 ~/.bash_profile 中添加
export PATH="/opt/homebrew/bin:$PATH"
```

## 方案二：使用 pyenv（推荐用于多版本管理）

### 1. 安装 Homebrew（如果未安装）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. 安装 pyenv

```bash
brew install pyenv
```

### 3. 配置 shell

在 `~/.zshrc` 中添加：

```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
```

然后重新加载配置：

```bash
source ~/.zshrc
```

### 4. 安装 Python 3.12

```bash
pyenv install 3.12.7
```

### 5. 设置全局或本地版本

```bash
# 全局设置（所有项目）
pyenv global 3.12.7

# 或仅在当前项目目录设置
cd /Users/zsq/Workspace/xiaohongshu-mcp-main/backend/python
pyenv local 3.12.7
```

### 6. 验证

```bash
python --version
python3 --version
```

## 方案三：从 python.org 下载安装包

### 1. 访问 Python 官网

https://www.python.org/downloads/

### 2. 下载 macOS 安装包

选择 Python 3.12.x 的 macOS 64-bit installer

### 3. 运行安装程序

双击下载的 `.pkg` 文件，按照提示安装

### 4. 验证安装

```bash
python3.12 --version
```

## 安装完成后

### 1. 验证 Python 版本

```bash
python3 --version
# 应该显示 Python 3.10.x 或更高版本
```

### 2. 升级 pip

```bash
python3 -m pip install --upgrade pip
```

### 3. 安装项目依赖

```bash
cd /Users/zsq/Workspace/xiaohongshu-mcp-main/backend/python
pip3 install -r requirements.txt
```

### 4. 验证 LangChain 1.0 安装

```bash
python3 -c "import langchain; print(langchain.__version__)"
python3 -c "import langgraph; print(langgraph.__version__)"
```

## 推荐方案

**推荐使用方案二（pyenv）**，因为：
- 可以管理多个 Python 版本
- 可以为不同项目设置不同版本
- 不会影响系统自带的 Python
- 切换版本方便

## 注意事项

1. **不要删除系统自带的 Python 3.9**，macOS 系统可能需要它
2. 如果使用 pyenv，确保在项目目录中设置了正确的 Python 版本
3. 安装后可能需要重新安装项目的依赖包
4. 如果使用虚拟环境，需要重新创建虚拟环境

## 虚拟环境（推荐）

升级 Python 后，建议使用虚拟环境：

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

