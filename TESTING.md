# 测试指南

本文档说明如何运行项目中的各种测试。

## 测试类型

项目包含以下类型的测试：

1. **Electron 主进程测试**（Jest + TypeScript）
2. **Go 后端测试**（Go 标准测试）
3. **Python 后端测试**（可选，使用 pytest）

## Electron 测试

### 运行所有测试

```bash
cd desktop/electron
npm test
```

### 监视模式运行测试

在开发时，可以使用监视模式自动运行测试：

```bash
cd desktop/electron
npm run test:watch
```

### 生成测试覆盖率报告

```bash
cd desktop/electron
npm run test:coverage
```

覆盖率报告会生成在 `desktop/electron/coverage/` 目录下，包括：
- 文本报告（终端输出）
- LCOV 报告（`coverage/lcov.info`）
- HTML 报告（`coverage/index.html`）

### 测试配置

测试配置在 `desktop/electron/jest.config.ts` 中：
- 测试环境：Node.js
- 测试文件匹配：`**/__tests__/**/*.test.ts` 或 `**/?(*.)+(spec|test).ts`
- 超时时间：10 秒

### 运行特定测试文件

```bash
cd desktop/electron
npx jest electron/__tests__/utils/path.test.ts
```

### 运行匹配模式的测试

```bash
cd desktop/electron
npx jest --testNamePattern="path"
```

## Go 后端测试

### 运行所有 Go 测试

```bash
cd backend/go
go test ./...
```

### 运行特定包的测试

```bash
cd backend/go
go test ./xiaohongshu
```

### 运行测试并显示详细输出

```bash
cd backend/go
go test -v ./...
```

### 运行测试并生成覆盖率报告

```bash
cd backend/go
go test -cover ./...
```

### 生成 HTML 覆盖率报告

```bash
cd backend/go
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

## Python 后端测试（如果存在）

如果项目中有 Python 测试，可以使用 pytest：

```bash
cd backend/python
# 激活虚拟环境（如果使用）
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 运行测试
pytest

# 运行测试并显示覆盖率
pytest --cov=app --cov-report=html
```

## 端到端测试

### 手动测试流程

1. **启动开发环境**
   ```bash
   cd desktop/electron
   npm run dev
   ```

2. **测试应用启动**
   - 检查 Electron 窗口是否正常打开
   - 检查后端服务是否正常启动（查看控制台日志）

3. **测试应用广场**
   - 打开应用，应该看到"应用广场"页面
   - 检查是否显示"小红书 Agent"应用卡片

4. **测试小红书 Agent**
   - 点击"小红书 Agent"卡片，进入聊天界面
   - 检查 WebSocket 连接状态
   - 发送测试消息，检查是否收到响应

5. **测试工具调用**
   - 发送需要调用工具的请求（如"搜索小红书内容"）
   - 检查工具调用是否正常执行
   - 检查 LLM 是否正确处理工具结果

### 自动化测试（待实现）

目前项目还没有端到端的自动化测试。可以考虑使用：
- **Playwright**：用于 Electron 应用的 E2E 测试
- **Spectron**：Electron 官方测试框架（已废弃，建议使用 Playwright）

## 测试最佳实践

1. **单元测试**：为每个工具函数编写单元测试
2. **集成测试**：测试服务之间的交互
3. **E2E 测试**：测试完整的用户流程
4. **覆盖率目标**：建议保持代码覆盖率在 70% 以上

## 常见问题

### Jest 找不到模块

如果遇到模块解析问题，检查 `jest.config.ts` 中的 `moduleNameMapper` 配置。

### 测试超时

如果测试运行时间较长，可以在 `jest.config.ts` 中增加 `testTimeout` 值。

### Go 测试需要浏览器

某些 Go 测试需要启动浏览器，确保：
- 已安装 Chrome/Chromium
- 设置了正确的浏览器路径环境变量

## 持续集成

可以在 CI/CD 流程中添加测试步骤：

```yaml
# 示例 GitHub Actions
- name: Run Electron tests
  run: |
    cd desktop/electron
    npm test

- name: Run Go tests
  run: |
    cd backend/go
    go test ./...
```

