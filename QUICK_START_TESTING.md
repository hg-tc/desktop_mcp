# 快速测试启动指南

## 前置条件

### 1. 安装依赖

首先确保已安装所有依赖：

```bash
# 进入 Electron 项目目录
cd desktop/electron

# 安装 Node.js 依赖（包括 Jest 测试框架）
npm install
```

### 2. 验证安装

检查 Jest 是否已安装：

```bash
cd desktop/electron
npx jest --version
```

如果显示版本号，说明安装成功。

## 运行测试

### Electron 测试（Jest）

#### 运行所有测试

```bash
cd desktop/electron
npm test
```

#### 监视模式（开发时推荐）

```bash
cd desktop/electron
npm run test:watch
```

这会监听文件变化，自动重新运行相关测试。

#### 生成覆盖率报告

```bash
cd desktop/electron
npm run test:coverage
```

报告会生成在 `coverage/` 目录，打开 `coverage/index.html` 查看详细报告。

#### 运行特定测试文件

```bash
cd desktop/electron
npx jest electron/__tests__/utils/path.test.ts
```

#### 运行匹配名称的测试

```bash
cd desktop/electron
npx jest --testNamePattern="path"
```

### Go 后端测试

#### 运行所有 Go 测试

```bash
cd backend/go
go test ./...
```

#### 运行特定包的测试

```bash
cd backend/go
go test ./xiaohongshu
```

#### 显示详细输出

```bash
cd backend/go
go test -v ./...
```

#### 生成覆盖率报告

```bash
cd backend/go
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
open coverage.html  # Mac
# 或
start coverage.html  # Windows
```

## 端到端测试（手动）

### 1. 启动开发环境

```bash
# 方式一：使用脚本
cd /Users/zsq/Workspace/xiaohongshu-mcp-main
./scripts/dev.sh

# 方式二：直接运行
cd desktop/electron
npm run dev
```

### 2. 测试检查清单

- [ ] Electron 窗口正常打开
- [ ] 应用广场页面显示正常
- [ ] "小红书 Agent" 应用卡片可见
- [ ] 点击卡片进入聊天界面
- [ ] WebSocket 连接状态显示"已连接"
- [ ] 发送消息后收到响应
- [ ] 工具调用正常工作（如果配置了 LLM）

### 3. 测试工具调用

发送测试消息，例如：
- "搜索小红书上的美食内容"
- "帮我发布一条笔记"

检查：
- [ ] 工具调用请求是否发送
- [ ] 工具执行结果是否正确返回
- [ ] LLM 是否正确处理工具结果

## 常见问题

### Jest 命令未找到

**问题**：`jest: command not found`

**解决**：
```bash
cd desktop/electron
npm install
```

### 测试超时

**问题**：测试运行时间过长导致超时

**解决**：在 `jest.config.ts` 中增加超时时间：
```typescript
testTimeout: 30000  // 30秒
```

### 模块解析错误

**问题**：`Cannot find module`

**解决**：检查 `jest.config.ts` 中的 `moduleNameMapper` 配置是否正确。

### Go 测试需要浏览器

**问题**：Go 测试失败，提示找不到浏览器

**解决**：
1. 确保已安装 Chrome/Chromium
2. 设置环境变量：
   ```bash
   export ROD_BROWSER_BIN=/path/to/chrome
   ```

## 测试脚本示例

### 一键运行所有测试

创建 `scripts/test-all.sh`：

```bash
#!/bin/bash
set -e

echo "🧪 运行 Electron 测试..."
cd desktop/electron
npm test

echo "🧪 运行 Go 测试..."
cd ../../backend/go
go test ./...

echo "✅ 所有测试完成！"
```

使用：
```bash
chmod +x scripts/test-all.sh
./scripts/test-all.sh
```

## 下一步

- 查看 [TESTING.md](./TESTING.md) 了解详细的测试文档
- 添加更多单元测试提高代码覆盖率
- 考虑集成 Playwright 进行 E2E 自动化测试

