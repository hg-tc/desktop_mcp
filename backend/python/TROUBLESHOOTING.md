# 故障排查指南

## 问题：Python 后端无法连接

### 症状
- 前端显示 "无法连接到后端: Failed to fetch"
- WebSocket 连接失败
- 健康检查 URL `http://127.0.0.1:18061/health` 无响应

### 常见原因和解决方案

#### 1. 端口被占用

**检查端口占用：**
```bash
lsof -ti :18061
```

**关闭占用端口的进程：**
```bash
# 查看占用端口的进程
lsof -i :18061

# 关闭进程（替换 PID 为实际进程 ID）
kill -9 <PID>
```

#### 2. Python 后端未启动

**检查后端是否运行：**
```bash
ps aux | grep "python.*app.main"
```

**手动启动后端（用于调试）：**
```bash
cd backend/python
source venv/bin/activate
python app/main.py
```

#### 3. 虚拟环境问题

**检查虚拟环境：**
```bash
cd backend/python
./venv/bin/python --version
# 应该显示 Python 3.12.12
```

**重新创建虚拟环境（如果需要）：**
```bash
cd backend/python
rm -rf venv
/opt/homebrew/bin/python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 4. 依赖包问题

**检查 LangChain 版本：**
```bash
cd backend/python
./venv/bin/python -c "import langchain; print(langchain.__version__)"
# 应该显示 1.0.x
```

**重新安装依赖：**
```bash
cd backend/python
source venv/bin/activate
pip install -r requirements.txt --upgrade
```

#### 5. 查看 Electron 主进程日志

在 Electron 开发工具中查看主进程日志，应该能看到：
```
[PythonBackend] 使用虚拟环境 Python: /path/to/venv/bin/python
[PythonBackend] 进程已启动，PID: xxxxx
```

如果看到错误信息，根据错误提示进行修复。

### 快速诊断命令

```bash
# 1. 检查端口
lsof -i :18061

# 2. 检查 Python 进程
ps aux | grep python | grep 18061

# 3. 测试健康检查
curl http://127.0.0.1:18061/health

# 4. 检查虚拟环境
cd backend/python && ./venv/bin/python --version

# 5. 测试导入
cd backend/python && ./venv/bin/python -c "from langchain.agents import create_agent; print('OK')"
```

### 重启服务

如果问题持续，尝试完全重启：

1. **关闭所有相关进程：**
```bash
pkill -f "python.*app.main"
pkill -f "electron"
```

2. **清理端口：**
```bash
lsof -ti :18061 | xargs kill -9
```

3. **重新启动：**
```bash
cd desktop/electron
npm run dev
```

