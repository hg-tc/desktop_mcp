# 小红书 Agent 桌面应用架构文档

## 📋 目录

1. [整体架构](#整体架构)
2. [技术栈](#技术栈)
3. [目录结构](#目录结构)
4. [核心组件](#核心组件)
5. [数据流](#数据流)
6. [通信机制](#通信机制)
7. [构建流程](#构建流程)

---

## 🏗️ 整体架构

这是一个基于 **Electron** 的桌面应用，采用 **三层架构**：

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用层                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Main Process│  │  Preload     │  │  Renderer    │ │
│  │  (Node.js)   │  │  (Bridge)    │  │  (React UI)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │ IPC
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Go 后端服务层                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  HTTP Server │  │  MCP Server  │  │  Browser     │ │
│  │  (Gin)       │  │  (SDK)       │  │  (Rod)       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    外部服务层                              │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  小红书 API   │  │  LLM API     │                    │
│  │  (Web)       │  │  (DeepSeek)  │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 架构特点

- **进程隔离**：Main Process（Node.js）和 Renderer Process（浏览器）分离
- **跨语言通信**：TypeScript/Node.js ↔ Go（通过 HTTP + MCP）
- **工具调用**：LLM 通过 MCP 协议调用 Go 后端工具
- **状态管理**：Electron Store + React State

---

## 🛠️ 技术栈

### 前端（Renderer Process）

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 18.3.1 | UI 框架 |
| **TypeScript** | 5.4.5 | 类型安全 |
| **Tailwind CSS** | 3.4.7 | 样式框架 |
| **Vite** | 5.2.11 | 构建工具（开发时 HMR） |

### 主进程（Main Process）

| 技术 | 版本 | 用途 |
|------|------|------|
| **Electron** | 31.7.7 | 桌面应用框架 |
| **Node.js** | 18+ | 运行时 |
| **TypeScript** | 5.4.5 | 类型安全 |
| **tsup** | 8.1.0 | 主进程/预加载脚本打包 |
| **electron-log** | 5.1.2 | 日志记录 |
| **electron-store** | - | 配置存储 |
| **keytar** | 7.9.0 | 系统钥匙串（API Key 存储） |

### 后端（Go Service）

| 技术 | 版本 | 用途 |
|------|------|------|
| **Go** | 1.21+ | 后端语言 |
| **Gin** | - | HTTP 框架 |
| **MCP SDK** | - | Model Context Protocol 实现 |
| **Rod** | - | 浏览器自动化（无头/有头） |

### Agent 层

| 技术 | 版本 | 用途 |
|------|------|------|
| **OpenAI SDK** | 4.58.1 | LLM API 客户端（兼容 OpenAI 格式） |
| **MCP SDK** | 1.21.1 | MCP 客户端（连接 Go 后端） |

---

## 📁 目录结构

```
xiaohongshu-mcp-main/
├── desktop/electron/              # Electron 应用根目录
│   ├── electron/                  # 主进程代码
│   │   ├── main.ts                # 主进程入口（窗口管理、后端启动）
│   │   ├── preload.ts             # 预加载脚本（IPC 桥接）
│   │   ├── settings.ts            # 设置管理（LLM、浏览器配置）
│   │   ├── mcpClient.ts           # MCP 客户端（连接 Go 后端）
│   │   └── agent/                 # Agent 核心逻辑
│   │       ├── conversationManager.ts  # 对话管理（工具调用循环）
│   │       └── llmClient.ts           # LLM 客户端封装
│   ├── src/renderer/              # 渲染进程代码（React UI）
│   │   ├── App.tsx                # 主组件（聊天界面、设置、登录）
│   │   ├── main.tsx               # React 入口
│   │   ├── index.html             # HTML 模板
│   │   └── index.css              # 全局样式（Tailwind）
│   ├── scripts/                   # 构建脚本
│   │   └── build-go.js            # Go 后端编译脚本
│   ├── dist/                      # 构建输出
│   │   ├── main.js                # 主进程打包文件
│   │   ├── preload.js             # 预加载脚本打包文件
│   │   ├── renderer/              # 渲染进程打包文件
│   │   └── bin/                   # Go 可执行文件
│   ├── release/                   # 打包输出（DMG、ZIP 等）
│   ├── package.json               # 项目配置
│   ├── tsconfig.json              # TypeScript 配置
│   ├── tsup.config.ts             # 主进程打包配置
│   ├── vite.config.ts             # 渲染进程打包配置
│   └── tailwind.config.ts         # Tailwind 配置
│
└── [项目根目录]/                  # Go 后端代码
    ├── main.go                    # Go 服务入口
    ├── app_server.go              # HTTP 服务器
    ├── mcp_server.go              # MCP 服务器（工具注册）
    ├── service.go                  # 业务逻辑层
    ├── handlers_api.go            # HTTP API 处理器
    ├── routes.go                  # 路由定义
    └── xiaohongshu/               # 小红书 API 封装
        ├── login.go               # 登录逻辑
        ├── search.go              # 搜索功能
        ├── publish.go             # 发布功能
        └── ...
```

---

## 🧩 核心组件

### 1. Main Process (`electron/main.ts`)

**职责**：
- 管理 Electron 窗口生命周期
- 启动/停止 Go 后端服务（子进程）
- 处理 IPC 通信（与 Renderer 进程）
- 管理设置存储（LLM 配置、浏览器路径）
- 初始化 Agent 组件（ConversationManager、McpClientManager）

**关键功能**：
```typescript
// 启动 Go 后端
startBackend() {
  const child = spawn('go', ['run', '.', '--desktop', '--port', '0'], {
    cwd: repoRoot,
    env: { COOKIES_PATH, ROD_BROWSER_BIN }
  });
  
  // 解析 stdout 获取服务地址
  child.stdout.on('data', (data) => {
    const match = data.toString().match(/APP_SERVER_ADDR=(.+)/);
    if (match) {
      const addr = match[1];
      const baseUrl = buildBackendBaseURL(addr);
      // 通知渲染进程
    }
  });
}

// IPC 处理器
ipcMain.handle('conversation:sendMessage', async (_, content) => {
  return conversationManager.sendUserMessage(content);
});
```

### 2. Preload Script (`electron/preload.ts`)

**职责**：
- 在 Renderer 和 Main 进程之间建立安全的 IPC 桥接
- 暴露安全的 API 给渲染进程（通过 `contextBridge`）

**暴露的 API**：
```typescript
window.backendAPI = {
  getInfo: () => ipcRenderer.invoke('backend:getInfo'),
  onStatus: (listener) => { /* 监听后端状态 */ }
};

window.conversationAPI = {
  sendMessage: (content) => ipcRenderer.invoke('conversation:sendMessage', content),
  onMessage: (listener) => { /* 监听消息 */ }
};

window.settingsAPI = {
  getLlmSettings: () => ipcRenderer.invoke('settings:getLlmSettings'),
  updateLlmSettings: (payload) => ipcRenderer.invoke('settings:updateLlmSettings', payload)
};
```

### 3. Renderer Process (`src/renderer/App.tsx`)

**职责**：
- 渲染用户界面（聊天窗口、设置面板、登录面板）
- 处理用户交互（发送消息、配置设置）
- 通过 `window.*API` 与主进程通信

**主要功能**：
- **聊天界面**：显示对话历史、发送消息、显示工具调用结果
- **设置面板**：配置 LLM API Key、模型、Base URL、浏览器路径
- **登录面板**：显示登录状态、二维码、清除 Cookies

### 4. Conversation Manager (`electron/agent/conversationManager.ts`)

**职责**：
- 管理对话状态（消息历史）
- 协调 LLM 和 MCP 工具调用
- 实现 Agent 循环（工具调用 → 结果处理 → 生成回复）

**工作流程**：
```typescript
async sendUserMessage(content: string) {
  // 1. 添加用户消息
  this.appendMessage({ role: 'user', content });
  
  // 2. 进入 Agent 循环
  while (iterations < MAX_ITERATIONS) {
    // 2.1 构建消息列表（包含工具返回结果）
    const messages = this.buildChatMessages();
    
    // 2.2 调用 LLM（带工具定义）
    const response = await llmClient.createChatCompletion({
      messages,
      tools: this.toolDefinitions
    });
    
    // 2.3 如果 LLM 返回工具调用
    if (response.toolCalls) {
      // 执行工具调用
      for (const call of response.toolCalls) {
        const result = await mcpClient.callTool(call.name, call.arguments);
        // 添加工具返回结果到消息历史
        this.appendMessage({ role: 'tool', content: result.content });
      }
      continue; // 继续循环，让 LLM 处理工具结果
    }
    
    // 2.4 如果 LLM 生成最终回复，退出循环
    break;
  }
  
  // 3. 返回最终回复
  return response;
}
```

### 5. MCP Client (`electron/mcpClient.ts`)

**职责**：
- 管理与 Go 后端的 MCP 连接（HTTP 传输）
- 列出可用工具
- 执行工具调用

**关键方法**：
```typescript
async connect(baseUrl: string) {
  const endpoint = `${baseUrl}/mcp`;
  this.transport = new StreamableHTTPClientTransport(endpoint);
  this.client = new Client({ name: 'xiaohongshu-agent-desktop' });
  await this.client.connect(this.transport);
}

async callTool(name: string, args: Record<string, unknown>) {
  const response = await this.client.callTool({ name, arguments: args });
  // 解析响应内容（文本/图片）
  return { content: textParts.join('\n'), raw: response, isError: response.isError };
}
```

### 6. LLM Client (`electron/agent/llmClient.ts`)

**职责**：
- 封装 OpenAI 兼容的 API 调用
- 处理工具调用格式转换
- 管理超时和重试

**关键方法**：
```typescript
async createChatCompletion(params: {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: 'auto' | { type: 'function', function: { name: string } };
}) {
  const response = await this.client.chat.completions.create({
    model: this.config.model,
    messages: params.messages,
    tools: params.tools,
    tool_choice: params.toolChoice ?? 'auto'
  });
  
  // 解析工具调用
  const toolCalls = response.choices[0].message?.tool_calls?.map(call => ({
    id: call.id,
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments)
  }));
  
  return { content: response.choices[0].message?.content, toolCalls };
}
```

### 7. Go 后端服务

**职责**：
- 提供 HTTP API（登录状态、二维码、发布等）
- 实现 MCP 服务器（注册工具、处理工具调用）
- 封装小红书 Web API（通过 Rod 浏览器自动化）

**关键组件**：
- **`app_server.go`**：HTTP 服务器（Gin）
- **`mcp_server.go`**：MCP 工具注册（12 个工具）
- **`service.go`**：业务逻辑层
- **`xiaohongshu/`**：小红书 API 封装

---

## 🔄 数据流

### 用户发送消息流程

```
用户输入 "搜索agent相关帖子"
    │
    ▼
Renderer (App.tsx)
    │ window.conversationAPI.sendMessage()
    ▼
Main Process (main.ts)
    │ ipcMain.handle('conversation:sendMessage')
    ▼
ConversationManager.sendUserMessage()
    │
    ├─→ 1. 添加用户消息到历史
    │
    ├─→ 2. 调用 LLM（带工具定义）
    │      LlmClient.createChatCompletion()
    │      │
    │      └─→ HTTP POST → LLM API (DeepSeek)
    │          │
    │          └─→ 返回: { toolCalls: [{ name: 'search_feeds', arguments: { keyword: 'agent' } }] }
    │
    ├─→ 3. 执行工具调用
    │      McpClient.callTool('search_feeds', { keyword: 'agent' })
    │      │
    │      └─→ HTTP POST → Go 后端 /mcp
    │          │
    │          └─→ Go 后端执行搜索，返回结果
    │
    ├─→ 4. 添加工具返回结果到历史
    │
    ├─→ 5. 再次调用 LLM（包含工具结果）
    │      └─→ LLM 生成最终回复
    │
    └─→ 6. 通过 IPC 发送消息到 Renderer
            │
            └─→ Renderer 更新 UI，显示回复
```

### 工具调用流程（MCP）

```
LLM 决定调用工具
    │
    ▼
ConversationManager.executeToolCall()
    │
    ▼
McpClient.callTool(name, args)
    │
    ├─→ 构建 MCP 请求
    │   {
    │     "jsonrpc": "2.0",
    │     "method": "tools/call",
    │     "params": {
    │       "name": "search_feeds",
    │       "arguments": { "keyword": "agent" }
    │     }
    │   }
    │
    ▼
HTTP POST → http://127.0.0.1:PORT/mcp
    │
    ▼
Go 后端 MCP Server
    │
    ├─→ 路由到工具处理器
    │   mcp_server.go: registerTools()
    │   │
    │   └─→ service.go: handleSearchFeeds()
    │       │
    │       └─→ xiaohongshu/search.go: SearchFeeds()
    │           │
    │           └─→ 使用 Rod 浏览器自动化
    │               │
    │               └─→ 访问小红书搜索页面
    │
    ▼
返回 MCP 响应
    {
      "jsonrpc": "2.0",
      "result": {
        "content": [
          { "type": "text", "text": "搜索结果..." }
        ]
      }
    }
    │
    ▼
McpClient 解析响应
    │
    └─→ 返回给 ConversationManager
        │
        └─→ 添加到消息历史
            │
            └─→ LLM 处理结果，生成回复
```

---

## 📡 通信机制

### 1. IPC（Inter-Process Communication）

**Main ↔ Renderer 通信**：

```typescript
// Main Process
ipcMain.handle('conversation:sendMessage', async (_, content) => {
  return await conversationManager.sendUserMessage(content);
});

ipcMain.on('conversation:message', (_, message) => {
  // 发送消息到所有渲染进程窗口
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('conversation:message', message);
  });
});

// Renderer Process (通过 preload)
window.conversationAPI.sendMessage('搜索agent')
  .then(state => {
    // 处理响应
  });

window.conversationAPI.onMessage((message) => {
  // 监听新消息
});
```

### 2. HTTP（Main ↔ Go 后端）

```typescript
// Main Process 启动 Go 后端
const child = spawn('go', ['run', '.', '--desktop', '--port', '0']);

// 解析 stdout 获取服务地址
child.stdout.on('data', (data) => {
  const match = data.toString().match(/APP_SERVER_ADDR=(.+)/);
  const baseUrl = buildBackendBaseURL(match[1]); // http://127.0.0.1:PORT
});

// MCP Client 连接
await mcpClient.connect(baseUrl); // http://127.0.0.1:PORT/mcp
```

### 3. MCP（Agent ↔ Go 后端）

**协议**：Model Context Protocol（基于 JSON-RPC 2.0）

**传输**：HTTP（StreamableHTTPClientTransport）

**消息格式**：
```json
// 工具调用请求
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_feeds",
    "arguments": { "keyword": "agent" }
  }
}

// 工具调用响应
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "搜索结果..." }
    ],
    "isError": false
  }
}
```

---

## 🏭 构建流程

### 开发模式

```bash
npm run dev
```

**并行执行**：
1. `dev:main` - `tsup --watch` 监听主进程代码变化
2. `dev:renderer` - `vite dev` 启动开发服务器（HMR）
3. `dev:electron` - 等待构建完成后启动 Electron

**流程**：
```
tsup 编译 main.ts, preload.ts → dist/main.js, dist/preload.js
    │
    ▼
Vite 编译 React 代码 → http://localhost:5173
    │
    ▼
Electron 启动
    ├─→ 加载 dist/main.js（主进程）
    ├─→ 加载 dist/preload.js（预加载脚本）
    └─→ 加载 http://localhost:5173（渲染进程，支持 HMR）
```

### 生产构建

```bash
npm run build
```

**步骤**：
1. `build:go` - 编译 Go 后端为可执行文件
   ```javascript
   // scripts/build-go.js
   spawn('go', ['build', '-o', 'dist/bin/xiaohongshu-mcp', '.'], {
     cwd: repoRoot
   });
   ```

2. `build:main` - 打包主进程和预加载脚本
   ```typescript
   // tsup.config.ts
   entry: ['electron/main.ts', 'electron/preload.ts']
   format: ['cjs']
   external: ['electron', 'keytar']
   ```

3. `build:renderer` - 打包渲染进程
   ```typescript
   // vite.config.ts
   build: {
     outDir: 'dist/renderer'
   }
   ```

4. `electron-builder` - 打包为桌面应用
   - macOS: DMG, ZIP
   - Windows: NSIS
   - Linux: AppImage

**输出结构**：
```
Xiaohongshu Agent.app/
├── Contents/
│   ├── MacOS/
│   │   └── Xiaohongshu Agent (Electron 主进程)
│   └── Resources/
│       ├── app.asar (打包的应用代码)
│       └── bin/
│           └── xiaohongshu-mcp (Go 可执行文件)
```

---

## 🔐 安全机制

### 1. Context Isolation

- **启用**：`contextIsolation: true`
- **作用**：隔离渲染进程和主进程，防止直接访问 Node.js API
- **实现**：通过 `preload.ts` 暴露安全的 API

### 2. API Key 存储

- **优先**：系统钥匙串（`keytar`）
- **降级**：本地加密文件（如果 keytar 不可用）

### 3. 进程隔离

- **Main Process**：完全访问 Node.js API
- **Renderer Process**：受限环境，只能通过 `window.*API` 访问

---

## 🎯 关键设计决策

### 1. 为什么使用 Electron？

- **跨平台**：一套代码支持 macOS、Windows、Linux
- **Web 技术栈**：React + TypeScript，开发效率高
- **原生能力**：可以调用系统 API、管理子进程

### 2. 为什么 Go 后端独立运行？

- **性能**：Go 的并发性能适合浏览器自动化
- **生态**：Rod 库提供强大的浏览器控制能力
- **隔离**：后端崩溃不影响前端 UI

### 3. 为什么使用 MCP 协议？

- **标准化**：Model Context Protocol 是标准协议
- **工具化**：LLM 可以动态发现和调用工具
- **可扩展**：易于添加新工具

### 4. 为什么工具调用需要循环？

- **多轮交互**：LLM 可能需要多次调用工具才能完成任务
- **结果处理**：工具返回结果后，LLM 需要处理并可能继续调用
- **灵活性**：支持复杂的多步骤任务

---

## 📊 性能优化

### 1. 代码分割

- **主进程**：使用 `tsup` 打包，外部依赖不打包
- **渲染进程**：使用 Vite 代码分割，按需加载

### 2. 资源管理

- **Go 后端**：按需启动，应用退出时自动关闭
- **浏览器实例**：Go 后端管理，支持无头/有头模式切换

### 3. 状态管理

- **对话历史**：内存中管理，支持重置
- **设置**：持久化到磁盘（electron-store）

---

## 🐛 调试

### 开发模式调试

1. **主进程日志**：终端输出（`electron-log`）
2. **渲染进程日志**：DevTools Console
3. **Go 后端日志**：终端输出（`logrus`）

### 生产模式调试

- **日志文件**：`~/Library/Logs/xiaohongshu-agent-desktop/` (macOS)
- **DevTools**：可以通过菜单打开（开发版本）

---

## 🔄 更新机制

目前使用 `electron-builder` 打包，支持：
- **DMG**：macOS 安装包
- **NSIS**：Windows 安装程序
- **AppImage**：Linux 可执行文件

未来可以集成 `electron-updater` 实现自动更新。

---

## 📝 总结

这是一个**三层架构**的桌面应用：

1. **前端层**：Electron + React，提供用户界面
2. **Agent 层**：LLM + MCP，实现智能对话和工具调用
3. **后端层**：Go + Rod，提供小红书 API 封装

通过 **IPC**、**HTTP**、**MCP** 三种通信机制，实现了跨语言、跨进程的协作，最终为用户提供了一个可以自然语言交互的小红书操作助手。

