# 项目目录结构

## 整体架构

```
xiaohongshu-mcp-main/
├── backend/              # 后端服务（统一管理）
│   ├── go/              # Go 后端（小红书 MCP 服务）
│   └── python/          # Python 后端（LLM 服务）
├── desktop/             # 桌面应用
│   └── electron/        # Electron 主程序
└── ...                  # 其他文件（文档、示例等）
```

## 详细结构

### backend/ - 后端服务目录

统一管理所有后端服务，便于维护和部署。

#### backend/go/ - Go 后端

小红书 MCP 服务，提供：
- HTTP API 接口
- MCP 协议服务
- 浏览器自动化（Rod）

**主要文件：**
- `main.go` - 服务入口
- `app_server.go` - HTTP 服务器
- `mcp_server.go` - MCP 服务器
- `service.go` - 业务逻辑
- `go.mod` / `go.sum` - Go 依赖管理

**子目录：**
- `xiaohongshu/` - 小红书 API 封装
- `browser/` - 浏览器自动化
- `configs/` - 配置管理
- `cookies/` - Cookie 管理
- `errors/` - 错误处理
- `pkg/` - 公共包

#### backend/python/ - Python 后端

LLM 服务，提供：
- WebSocket 接口
- OpenAI 兼容 API 封装
- 流式响应支持

**主要文件：**
- `main.py` - 服务入口
- `server.py` - WebSocket 服务器
- `client.py` - OpenAI 客户端封装
- `models.py` - 数据模型
- `config.py` - 配置管理
- `requirements.txt` - Python 依赖

### desktop/electron/ - Electron 主程序

桌面应用主程序，负责：
- 窗口管理
- 后端服务启动和管理
- IPC 通信
- UI 渲染

**主要目录：**
- `electron/` - 主进程代码
  - `main.ts` - 主进程入口
  - `agent/` - Agent 逻辑
  - `preload.ts` - 预加载脚本
- `src/renderer/` - 渲染进程代码（React UI）
- `scripts/` - 构建脚本
- `dist/` - 构建输出
- `release/` - 打包输出

## 服务启动流程

1. **Electron 主进程启动** (`desktop/electron/electron/main.ts`)
2. **启动 Go 后端** (`backend/go/main.go`)
   - 监听动态分配的端口
   - 提供 HTTP API 和 MCP 服务
3. **启动 Python 后端** (`backend/python/main.py`)
   - 监听 18061 端口（WebSocket）
   - 提供 LLM 服务
4. **建立连接**
   - Electron ↔ Go 后端（HTTP + MCP）
   - Electron ↔ Python 后端（WebSocket）

## 开发环境

### Go 后端开发

```bash
cd backend/go
go run . --desktop --port 0
```

### Python 后端开发

```bash
cd backend/python
pip install -r requirements.txt
python main.py
```

### Electron 开发

```bash
cd desktop/electron
npm install
npm run dev
```

## 构建和打包

### 构建 Go 后端

```bash
cd desktop/electron
npm run build:go
```

### 构建 Electron 应用

```bash
cd desktop/electron
npm run build
```

打包后的结构：
- `release/` - 打包输出
- `dist/bin/` - Go 可执行文件
- `dist/` - Electron 打包文件

## 路径引用

### Electron 主进程中的路径

- Go 后端路径：`backend/go/`（开发）或 `resources/bin/`（打包）
- Python 后端路径：`backend/python/`（开发）或 `resources/backend/python/`（打包）

### 构建脚本路径

- `desktop/electron/scripts/build-go.js` - 构建 Go 后端到 `dist/bin/`

## 优势

1. **统一管理**：所有后端服务集中在一个目录
2. **清晰分离**：前端（Electron）和后端（Go/Python）职责明确
3. **易于维护**：每个后端服务独立，便于更新和调试
4. **部署友好**：打包时可以统一处理所有后端资源

