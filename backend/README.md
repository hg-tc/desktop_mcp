# 后端服务

统一的后端服务目录，包含两个后端服务：

## 目录结构

```
backend/
├── go/          # Go 后端（小红书 MCP 服务）
│   ├── main.go
│   ├── go.mod
│   └── ...
└── python/      # Python 后端（LLM 服务）
    ├── main.py
    ├── requirements.txt
    └── ...
```

## Go 后端

小红书 MCP 服务，提供：
- HTTP API 接口
- MCP 协议服务
- 浏览器自动化（Rod）

### 运行

```bash
cd backend/go
go run . --desktop --port 0
```

### 构建

```bash
cd backend/go
go build -o xiaohongshu-mcp .
```

## Python 后端

LLM 服务，提供：
- WebSocket 接口
- OpenAI 兼容 API 封装
- 流式响应支持

### 安装依赖

```bash
cd backend/python
pip install -r requirements.txt
```

### 运行

```bash
cd backend/python
python main.py
```

## 与 Electron 集成

两个后端服务都由 Electron 主进程自动启动和管理：
- Go 后端：通过 `spawn` 启动，监听动态分配的端口
- Python 后端：通过 `spawn` 启动，默认监听 18061 端口

详见 `desktop/electron/electron/main.ts`。

