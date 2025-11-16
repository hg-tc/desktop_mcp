# 虚拟环境使用说明

## Python 升级完成 ✅

- **Python 版本**: 3.12.12
- **LangChain**: 1.0.5
- **LangGraph**: 1.0.3
- **LangChain Core**: 1.0.5
- **LangChain OpenAI**: 1.0.3

## 激活虚拟环境

每次使用项目前，需要激活虚拟环境：

```bash
cd /Users/zsq/Workspace/xiaohongshu-mcp-main/backend/python
source venv/bin/activate
```

激活后，命令行提示符前会显示 `(venv)`。

## 运行项目

激活虚拟环境后，可以正常运行项目：

```bash
# 激活虚拟环境
source venv/bin/activate

# 运行主程序
python main.py

# 或使用 uvicorn
uvicorn app.main:app --host 127.0.0.1 --port 18061
```

## 退出虚拟环境

```bash
deactivate
```

## 更新依赖

```bash
source venv/bin/activate
pip install -r requirements.txt --upgrade
```

## 注意事项

1. **每次使用项目前都要激活虚拟环境**
2. 虚拟环境已包含所有依赖，包括 LangChain 1.0 和 LangGraph 1.0
3. 如果使用 IDE（如 PyCharm、VSCode），需要配置使用虚拟环境中的 Python 解释器

## IDE 配置

### VSCode
1. 打开命令面板（Cmd+Shift+P）
2. 选择 "Python: Select Interpreter"
3. 选择 `./venv/bin/python`

### PyCharm
1. File → Settings → Project → Python Interpreter
2. 选择 `./venv/bin/python`

