"""数据模型定义"""
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """聊天消息"""
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    tool_call_id: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class ToolDefinition(BaseModel):
    """工具定义"""
    type: Literal["function"] = "function"
    function: Dict[str, Any] = Field(..., description="函数定义，包含 name, description, parameters")


class ChatRequest(BaseModel):
    """聊天请求"""
    type: Literal["chat"] = "chat"
    messages: List[ChatMessage]
    tools: Optional[List[ToolDefinition]] = None
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="配置项：model, temperature, stream 等")


class ChunkResponse(BaseModel):
    """流式文本块响应"""
    type: Literal["chunk"] = "chunk"
    content: str
    done: bool = False


class ToolCallResponse(BaseModel):
    """工具调用响应"""
    type: Literal["tool_call"] = "tool_call"
    tool_calls: List[Dict[str, Any]]
    done: bool = False


class DoneResponse(BaseModel):
    """完成响应"""
    type: Literal["done"] = "done"
    finish_reason: str
    done: bool = True


class ErrorResponse(BaseModel):
    """错误响应"""
    type: Literal["error"] = "error"
    error: str
    done: bool = True

