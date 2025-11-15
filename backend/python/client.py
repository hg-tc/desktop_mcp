"""OpenAI 客户端封装"""
import json
import logging
from typing import AsyncIterator, Dict, List, Optional, Any
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionTool

from .config import Config
from .models import ChatMessage, ToolDefinition

logger = logging.getLogger(__name__)


class OpenAIClient:
    """OpenAI 兼容客户端封装"""
    
    def __init__(self):
        if not Config.validate():
            raise ValueError("OpenAI 配置不完整，请设置 OPENAI_API_KEY 和 OPENAI_BASE_URL")
        
        self.client = AsyncOpenAI(
            api_key=Config.OPENAI_API_KEY,
            base_url=Config.OPENAI_BASE_URL,
            timeout=Config.DEFAULT_TIMEOUT,
            max_retries=Config.DEFAULT_MAX_RETRIES,
        )
        self.model = Config.OPENAI_MODEL
        logger.info(f"OpenAI 客户端初始化完成: base_url={Config.OPENAI_BASE_URL}, model={self.model}")
    
    def _convert_messages(
        self, messages: List[ChatMessage]
    ) -> List[ChatCompletionMessageParam]:
        """转换消息格式为 OpenAI 格式"""
        result: List[ChatCompletionMessageParam] = []
        
        for msg in messages:
            if msg.role == "system":
                result.append({"role": "system", "content": msg.content})
            elif msg.role == "user":
                result.append({"role": "user", "content": msg.content})
            elif msg.role == "assistant":
                if msg.tool_calls:
                    # 包含工具调用的 assistant 消息
                    result.append({
                        "role": "assistant",
                        "content": msg.content or None,
                        "tool_calls": [
                            {
                                "id": tc.get("id", ""),
                                "type": "function",
                                "function": {
                                    "name": tc.get("name", ""),
                                    "arguments": json.dumps(tc.get("arguments", {}), ensure_ascii=False)
                                }
                            }
                            for tc in msg.tool_calls
                        ]
                    })
                else:
                    result.append({"role": "assistant", "content": msg.content})
            elif msg.role == "tool":
                # tool 消息需要 tool_call_id
                if msg.tool_call_id:
                    result.append({
                        "role": "tool",
                        "tool_call_id": msg.tool_call_id,
                        "content": msg.content
                    })
        
        return result
    
    def _convert_tools(
        self, tools: Optional[List[ToolDefinition]]
    ) -> Optional[List[ChatCompletionTool]]:
        """转换工具定义为 OpenAI 格式"""
        if not tools:
            return None
        
        result: List[ChatCompletionTool] = []
        for tool in tools:
            if tool.type == "function":
                result.append({
                    "type": "function",
                    "function": tool.function
                })
        
        return result if result else None
    
    async def create_chat_completion_stream(
        self,
        messages: List[ChatMessage],
        tools: Optional[List[ToolDefinition]] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        tool_choice: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """创建流式聊天完成"""
        openai_messages = self._convert_messages(messages)
        openai_tools = self._convert_tools(tools)
        model_name = model or self.model
        
        logger.info(
            f"创建流式聊天完成: model={model_name}, message_count={len(openai_messages)}, "
            f"tool_count={len(openai_tools) if openai_tools else 0}"
        )
        
        try:
            # 准备请求参数
            request_params: Dict[str, Any] = {
                "model": model_name,
                "messages": openai_messages,
                "temperature": temperature,
                "stream": True,
            }
            
            if openai_tools:
                request_params["tools"] = openai_tools
                # tool_choice 处理
                if tool_choice:
                    request_params["tool_choice"] = tool_choice
                else:
                    request_params["tool_choice"] = "auto"
            
            # 流式调用
            stream = await self.client.chat.completions.create(**request_params)
            
            accumulated_content = ""
            tool_calls: List[Dict[str, Any]] = []
            current_tool_call: Optional[Dict[str, Any]] = None
            
            async for chunk in stream:
                if not chunk.choices:
                    continue
                
                choice = chunk.choices[0]
                delta = choice.delta
                
                # 处理文本内容
                if delta.content:
                    accumulated_content += delta.content
                    yield {
                        "type": "chunk",
                        "content": delta.content,
                        "done": False
                    }
                
                # 处理工具调用
                if delta.tool_calls:
                    for tool_call_delta in delta.tool_calls:
                        index = tool_call_delta.index
                        
                        # 开始新的工具调用
                        if tool_call_delta.index == len(tool_calls):
                            tool_calls.append({
                                "id": tool_call_delta.id or "",
                                "type": "function",
                                "function": {
                                    "name": "",
                                    "arguments": ""
                                }
                            })
                            current_tool_call = tool_calls[index]
                        
                        # 更新工具调用信息
                        if tool_call_delta.function:
                            if tool_call_delta.function.name:
                                current_tool_call["function"]["name"] = tool_call_delta.function.name
                            if tool_call_delta.function.arguments:
                                current_tool_call["function"]["arguments"] += tool_call_delta.function.arguments
                
                # 检查是否完成
                if choice.finish_reason:
                    finish_reason = choice.finish_reason
                    
                    # 如果有工具调用，发送工具调用响应
                    if tool_calls:
                        # 解析工具调用参数
                        for tc in tool_calls:
                            try:
                                args_str = tc["function"].get("arguments", "{}")
                                tc["function"]["arguments"] = json.loads(args_str)
                            except json.JSONDecodeError:
                                logger.warning(f"无法解析工具调用参数: {args_str}")
                                tc["function"]["arguments"] = {}
                        
                        yield {
                            "type": "tool_call",
                            "tool_calls": tool_calls,
                            "done": False
                        }
                    
                    # 发送完成响应
                    yield {
                        "type": "done",
                        "finish_reason": finish_reason,
                        "content": accumulated_content if accumulated_content else None,
                        "done": True
                    }
                    break
        
        except Exception as e:
            logger.error(f"流式聊天完成失败: {e}", exc_info=True)
            yield {
                "type": "error",
                "error": str(e),
                "done": True
            }

