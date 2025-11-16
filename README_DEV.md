# 开发环境使用说明

## 快速开始

### 1. 确保虚拟环境已创建

虚拟环境应该已经创建在 `backend/python/venv/` 目录下。如果不存在，运行：

```bash
cd backend/python
/opt/homebrew/bin/python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 直接运行 npm run dev

**不需要手动 source 虚拟环境！** Electron 会自动使用虚拟环境中的 Python。

```bash
cd desktop/electron
npm run dev
```

## 工作原理

Electron 应用在启动 Python 后端时，会：

1. **开发环境**：自动检测并使用 `backend/python/venv/bin/python`（如果存在）
2. **如果没有虚拟环境**：回退到系统 Python（`python3` 或 `python`）
3. **打包环境**：使用打包的虚拟环境或可执行文件

## 验证虚拟环境

运行 `npm run dev` 后，在控制台日志中应该看到：

```
[PythonBackend] 使用虚拟环境 Python: /path/to/backend/python/venv/bin/python
```

如果看到：

```
[PythonBackend] 虚拟环境不存在，尝试使用系统 Python
```

说明虚拟环境不存在，需要先创建。

## 常见问题

### Q: 为什么不需要 source？

A: 因为 Electron 直接调用虚拟环境中的 Python 可执行文件（`venv/bin/python`），而不是通过 shell 激活虚拟环境。这样更可靠，不依赖 shell 环境。

### Q: 如果虚拟环境不存在会怎样？

A: Electron 会回退到系统 Python，但可能会遇到以下问题：
- 系统 Python 版本可能不是 3.10+
- 依赖包可能未安装
- LangChain 1.0 可能无法安装（需要 Python 3.10+）

### Q: 如何确认使用的是虚拟环境？

A: 查看 Electron 控制台日志，应该看到：
```
[PythonBackend] 使用虚拟环境 Python: ...
```

或者检查 Python 版本：
```bash
backend/python/venv/bin/python --version
# 应该显示 Python 3.12.12
```

## 手动测试 Python 后端

如果想单独测试 Python 后端（不使用 Electron），仍然需要激活虚拟环境：

```bash
cd backend/python
source venv/bin/activate
python app/main.py
```

## 总结

- ✅ **使用 `npm run dev`**：不需要手动 source，Electron 自动处理
- ✅ **单独运行 Python**：需要手动 source 虚拟环境
- ✅ **虚拟环境位置**：`backend/python/venv/`

