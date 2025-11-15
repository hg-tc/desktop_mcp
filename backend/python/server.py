"""WebSocket 服务器"""
import json
import logging
from typing import Dict, Optional, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse

from .config import Config
from .models import ChatRequest, ErrorResponse
from .client import OpenAIClient

logger = logging.getLogger(__name__)

app = FastAPI(title="LLM Backend", version="0.1.0")

# 全局 OpenAI 客户端实例
openai_client: Optional[OpenAIClient] = None

# 活跃的 WebSocket 连接
active_connections: Set[WebSocket] = set()


def get_client() -> OpenAIClient:
    """获取或创建 OpenAI 客户端"""
    global openai_client
    if openai_client is None:
        openai_client = OpenAIClient()
    return openai_client


@app.get("/health")
async def health_check():
    """健康检查端点"""
    try:
        client = get_client()
        return JSONResponse({
            "status": "ok",
            "service": "llm-backend",
            "model": client.model,
            "base_url": Config.OPENAI_BASE_URL
        })
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 端点"""
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"WebSocket 连接建立，当前连接数: {len(active_connections)}")
    
    try:
        client = get_client()
        
        while True:
            # 接收消息
            data = await websocket.receive_text()
            
            try:
                request_data = json.loads(data)
                request = ChatRequest(**request_data)
            except Exception as e:
                logger.error(f"解析请求失败: {e}")
                error_response = ErrorResponse(error=f"无效的请求格式: {e}")
                await websocket.send_json(error_response.model_dump())
                continue
            
            # 处理聊天请求
            if request.type == "chat":
                await handle_chat_request(websocket, client, request)
            else:
                error_response = ErrorResponse(error=f"未知的请求类型: {request.type}")
                await websocket.send_json(error_response.model_dump())
    
    except WebSocketDisconnect:
        logger.info("WebSocket 连接断开")
    except Exception as e:
        logger.error(f"WebSocket 处理错误: {e}", exc_info=True)
        try:
            error_response = ErrorResponse(error=str(e))
            await websocket.send_json(error_response.model_dump())
        except:
            pass
    finally:
        active_connections.discard(websocket)
        logger.info(f"WebSocket 连接关闭，当前连接数: {len(active_connections)}")


async def handle_chat_request(
    websocket: WebSocket,
    client: OpenAIClient,
    request: ChatRequest
):
    """处理聊天请求"""
    config = request.config or {}
    model = config.get("model") or client.model
    temperature = config.get("temperature", Config.DEFAULT_TEMPERATURE)
    tool_choice = config.get("tool_choice")
    
    logger.info(
        f"处理聊天请求: model={model}, message_count={len(request.messages)}, "
        f"tool_count={len(request.tools) if request.tools else 0}"
    )
    
    try:
        # 创建流式响应
        async for response_chunk in client.create_chat_completion_stream(
            messages=request.messages,
            tools=request.tools,
            model=model,
            temperature=temperature,
            tool_choice=tool_choice,
        ):
            # 发送响应块
            await websocket.send_json(response_chunk)
    
    except Exception as e:
        logger.error(f"处理聊天请求失败: {e}", exc_info=True)
        error_response = ErrorResponse(error=str(e))
        await websocket.send_json(error_response.model_dump())


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    logger.info("关闭 LLM 后端服务")
    # 关闭所有 WebSocket 连接
    for connection in list(active_connections):
        try:
            await connection.close()
        except:
            pass
    active_connections.clear()

