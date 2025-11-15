# 小红书 Agent 桌面应用

基于 Electron 的桌面应用，集成小红书 MCP 服务和 LLM Agent，提供智能对话和自动化操作能力。

## 项目简介

这是一个桌面应用，集成了：
- **小红书 MCP 服务**：提供小红书平台的自动化操作（搜索、发布、点赞等）
- **LLM Agent**：通过大语言模型理解用户意图，自动调用 MCP 工具完成任务
- **流式响应**：实时显示 AI 回复，提升用户体验

## 技术架构

- **前端**：Electron + React + TypeScript
- **后端服务**：
  - Go 后端：小红书 MCP 服务（HTTP + MCP 协议）
  - Python 后端：LLM 服务（WebSocket 流式响应）

详见 [STRUCTURE.md](./STRUCTURE.md) 和 [desktop/electron/ARCHITECTURE.md](./desktop/electron/ARCHITECTURE.md)

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+
- Go 1.21+（用于构建 Go 后端）

### 安装依赖

1. **安装 Node.js 依赖**
```bash
cd desktop/electron
npm install
```

2. **安装 Python 依赖**
```bash
cd backend/python
pip install -r requirements.txt
```

### 开发运行

```bash
cd desktop/electron
npm run dev
```

这将启动：
- Electron 应用
- Go 后端服务（自动启动）
- Python LLM 后端服务（自动启动）

### 构建应用

```bash
cd desktop/electron
npm run build
```

构建产物在 `desktop/electron/release/` 目录。

## 配置说明

### LLM 配置

首次运行需要在设置中配置：
- **API Key**：你的 LLM API Key（如 DeepSeek、OpenAI 等）
- **Base URL**：API 服务地址
- **Model**：模型名称（如 `deepseek-chat`）

### 登录小红书

应用启动后，点击"打开浏览器登录"按钮，在浏览器中完成小红书登录。登录状态会自动保存。

## 功能特性

- ✅ 智能对话：通过 LLM 理解自然语言，自动执行操作
- ✅ 工具调用：自动识别需要调用的小红书操作工具
- ✅ 流式响应：实时显示 AI 回复，打字机效果
- ✅ 登录管理：自动保存和管理登录状态
- ✅ 跨平台：支持 Windows、macOS、Linux

## 项目结构

```
xiaohongshu-mcp-main/
├── backend/              # 后端服务
│   ├── go/              # Go 后端（小红书 MCP）
│   └── python/           # Python 后端（LLM 服务）
├── desktop/
│   └── electron/         # Electron 桌面应用
└── docs/                 # 文档
```

详见 [STRUCTURE.md](./STRUCTURE.md)

## 开发文档

- [项目结构说明](./STRUCTURE.md)
- [Electron 应用架构](./desktop/electron/ARCHITECTURE.md)
- [后端服务说明](./backend/README.md)
- [Electron 应用 README](./desktop/electron/README.md)

## 许可证

MIT License
