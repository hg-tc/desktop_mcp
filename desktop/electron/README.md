# Xiaohongshu Agent Desktop

Electron 桌面应用封装，小红书 MCP 服务的一体化对话体验。

## 功能概览

- 桌面端对话窗口，集成 LLM 与 MCP 工具调用。
- 登录管理：扫码登录、Cookies 状态查询与重置。
- 设置抽屉：配置 LLM API Key、模型信息及浏览器路径。
- Go 服务自动启动与健康检查，支持 `port=0` 自动分配端口。

## 开发环境要求

- Node.js ≥ 18
- npm ≥ 9
- Go ≥ 1.21
- 已安装 Chrome / Chromium（可在设置中手动指定路径）

如网络环境无法直接下载 Electron 二进制，可在安装依赖时设置：

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
```

## 快速开始

```bash
cd desktop/electron
npm install             # 安装依赖（可配合上方环境变量）
npm run dev             # 开发模式（Electron + Vite + tsup）
```

开发模式下：

- `tsup` 监听并编译主进程与预加载脚本。
- `vite` 提供渲染进程 HMR。
- Electron 主进程启动后会自动运行 Go 后端（`go run . --desktop`），并将实际端口写入 `APP_SERVER_ADDR=...`。

## 打包

```bash
# 可选：预编译 Go 服务为静态二进制
npm run build:go

# 完整打包
npm run build
```

打包输出位于 `release/`，默认生成：

- macOS：`dmg`、`zip`
- Windows：`nsis`
- Linux：`AppImage`

## 主要脚本

| 命令               | 说明                                                     |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | 开发调试（并行启动 tsup、Vite、Electron）                |
| `npm run build`    | 构建 Go 服务 + 主进程 + 渲染进程并交给 electron-builder |
| `npm run build:go` | 单独编译 Go 后端，输出至 `dist/bin/`                     |
| `npm run build:main` / `build:renderer` | 分别构建主进程与渲染进程           |

## 登录与 Cookies

- 登录状态面板可查看当前账号、二维码以及 Cookies 文件位置。
- “获取二维码” 会将 rod 浏览器切换到非无头模式打开，返回 Base64 图片供前端展示。
- “清除 Cookies” 会删除当前设置目录（默认 `app.getPath('userData')/cookies/cookies.json`）中的缓存文件。

## 配置说明

### LLM

- 默认使用 OpenAI 兼容接口，可在设置抽屉中修改模型与 Base URL。
- API Key 会优先存储在系统钥匙串（`keytar`），如不可用则退回到本地加密文件。

#### DeepSeek 配置示例

DeepSeek 的 API 是 OpenAI 兼容的，可以直接使用。在设置中配置：

- **服务商**：`deepseek`（或任意标识）
- **模型**：`deepseek-chat` 或 `deepseek-coder`（**重要：请使用标准模型名称**）
- **Base URL**：`https://api.deepseek.com/v1`
- **API Key**：你的 DeepSeek API Key

**重要提示**：
- 请使用 DeepSeek 官方文档中的标准模型名称，如 `deepseek-chat`、`deepseek-coder`
- **某些自定义或版本号模型名称（如 `deepseek-v3-1-250821`）可能不支持工具调用功能**
- 如果工具调用不工作，请尝试切换到 `deepseek-chat` 模型
- 如果模型一直不调用工具，应用会显示明确的错误提示，建议切换到标准模型

配置完成后，应用会自动支持工具调用功能。如果工具调用卡住，请检查：

1. 终端日志中是否有错误信息（`npm run dev` 时会显示详细日志）
2. DevTools Console 中是否有网络错误
3. 确认 DeepSeek API Key 有效且有足够余额
4. 检查日志中的 `warning` 字段，如果显示 "Model returned stop without tool calls"，说明模型没有选择使用工具

### 浏览器路径

- 默认读取系统 Chrome；如未安装可在设置中指定自定义 `bin` 路径。
- Go 服务会将 `COOKIES_PATH` 指向 `userData/cookies/`，便于跨平台封装。

## 注意事项

- 首次安装时如需要编译 `keytar`，请确保已安装 Xcode Command Line Tools（macOS）。
- Windows 打包需在对应平台执行，以获取正确的二进制。
- 若使用私有化 OpenAI 兼容接口，请确认网络可达并在设置中同步修改 Base URL。

