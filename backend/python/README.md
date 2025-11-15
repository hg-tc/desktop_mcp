# LLM 后端服务

Python 实现的 LLM 后端服务，通过 WebSocket 提供流式响应。

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行

### 开发环境

```bash
python main.py
```

或者：

```bash
python -m llm-backend.main
```

### 环境变量

- `OPENAI_API_KEY`: OpenAI API Key（必需）
- `OPENAI_BASE_URL`: OpenAI 兼容 API 基础 URL（必需）
- `OPENAI_MODEL`: 模型名称（默认：gpt-4o-mini）
- `LLM_WS_HOST`: WebSocket 服务器主机（默认：127.0.0.1）
- `LLM_WS_PORT`: WebSocket 服务器端口（默认：18061）
- `LOG_LEVEL`: 日志级别（默认：INFO）

## API

### WebSocket 端点

- `ws://127.0.0.1:18061/ws`

### HTTP 端点

- `GET /health`: 健康检查

## 消息格式

### 客户端 → 服务器

```json
{
  "type": "chat",
  "messages": [
    {
      "role": "user",
      "content": "你好"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "search_feeds",
        "description": "搜索小红书内容",
        "parameters": {
          "type": "object",
          "properties": {
            "keyword": {
              "type": "string",
              "description": "搜索关键词"
            }
          }
        }
      }
    }
  ],
  "config": {
    "model": "deepseek-chat",
    "temperature": 0.3,
    "stream": true
  }
}
```

### 服务器 → 客户端（流式）

```json
{
  "type": "chunk",
  "content": "部分文本",
  "done": false
}
```

```json
{
  "type": "tool_call",
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "search_feeds",
        "arguments": {
          "keyword": "agent"
        }
      }
    }
  ],
  "done": false
}
```

```json
{
  "type": "done",
  "finish_reason": "stop",
  "content": "完整回复内容",
  "done": true
}
```

```json
{
  "type": "error",
  "error": "错误信息",
  "done": true
}
```

