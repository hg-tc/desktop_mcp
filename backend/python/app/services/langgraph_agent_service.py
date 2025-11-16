"""
LangGraph Agent 服务
使用 LangChain 1.0 的 create_agent 自动处理工具调用
"""
import json
import logging
from typing import Dict, List, Any, Optional
try:
    # LangChain 1.0: 尝试从 langchain.agents 导入 create_agent
    from langchain.agents import create_agent
    LANGCHAIN_1_0 = True
except ImportError:
    # 向后兼容：如果不存在，尝试使用 langgraph.prebuilt
    try:
        from langgraph.prebuilt import create_react_agent as create_agent
        LANGCHAIN_1_0 = False
    except ImportError:
        raise ImportError("无法导入 create_agent 或 create_react_agent，请检查 LangChain/LangGraph 版本")

from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import BaseTool

from app.core.config import settings
from app.services.llm_client_service import get_llm_client_service

logger = logging.getLogger(__name__)


class LangGraphAgentService:
    """LangGraph Agent 服务，负责创建和管理 Agent 实例"""
    
    _instance: Optional["LangGraphAgentService"] = None
    
    def __init__(self):
        self._agent = None
        self._tools: List[BaseTool] = []
        self._llm_client_service = get_llm_client_service()
        self._tools_signature: Optional[str] = None
        self._system_prompt = """你是一个智能小红书内容助手，可以帮助用户搜索、浏览和管理小红书内容。

重要：当用户询问任何需要实时信息、搜索内容、查看详情、发布内容等操作时，你必须使用可用的工具来完成这些任务。不要告诉用户你无法执行，而是直接调用相应的工具。

可用工具包括：
- search_feeds: 搜索小红书内容（需要关键词参数）
- get_feed_detail: 获取内容详情（需要 feed_id 参数）
- list_feeds: 获取首页推荐内容
- publish_content: 发布图文内容

使用规则：
1. 如果用户询问搜索相关内容，立即调用 search_feeds 工具
2. 如果用户询问查看详情，立即调用 get_feed_detail 工具
3. 如果用户询问首页推荐，立即调用 list_feeds 工具
4. 如果用户要求发布内容，立即调用 publish_content 工具
5. 不要在没有调用工具的情况下告诉用户你无法执行操作

重要提示：如果你无法直接调用工具（例如你的模型不支持 function calling），请以 JSON 格式返回工具调用信息：
- 搜索内容时，返回：{"keyword": "搜索关键词"}
- 查看详情时，返回：{"feed_id": "笔记ID"}
- 查询时，返回：{"query": "查询关键词"}（会被转换为搜索）

请根据用户的需求，立即选择合适的工具并调用它们。"""
    
    @classmethod
    def get_instance(cls) -> "LangGraphAgentService":
        """获取单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def initialize_agent(self, tools: List[BaseTool]) -> None:
        """
        初始化 Agent
        
        Args:
            tools: LangChain Tool 列表
        """
        self._tools = tools or []
        tools_signature = ",".join(sorted(tool.name for tool in self._tools))
        if self._agent is not None and tools_signature == getattr(self, "_tools_signature", None):
            logger.info("[Agent] 已使用相同工具初始化，跳过重建")
            return
        self._tools_signature = tools_signature
        if not self._tools:
            logger.warning("[Agent] 无工具")
        
        llm_service = get_llm_client_service()
        headers = llm_service.get_headers()
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY 未配置")
        
        model_kwargs: Dict[str, Any] = {}
        if headers:
            model_kwargs["default_headers"] = headers
        
        llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            base_url=settings.OPENAI_BASE_URL,
            api_key=api_key,
            temperature=0.3,
            timeout=settings.LLM_REQUEST_TIMEOUT,
            **model_kwargs,
        )
        
        try:
            if LANGCHAIN_1_0:
                self._agent = create_agent(
                    model=llm,
                    tools=self._tools,
                    system_prompt=self._system_prompt,
                )
            else:
                self._agent = create_agent(
                    llm,
                    tools=self._tools,
                    prompt=self._system_prompt,
                )
            logger.info("[Agent] 创建成功")
        except Exception as e:
            logger.error(f"[Agent] 创建失败: {e}", exc_info=True)
            raise
    
    async def stream_agent_response(
        self,
        messages: List[Dict[str, Any]],
        websocket_send_func
    ) -> None:
        """
        流式执行 Agent 并发送响应到 WebSocket
        
        Args:
            messages: 消息列表（格式：{"role": "user", "content": "..."}）
            websocket_send_func: WebSocket 发送函数（async 函数，接受 dict 参数）
        """
        if not self._agent:
            raise RuntimeError("Agent 未初始化，请先调用 initialize_agent()")
        
        if not self._tools:
            logger.warning("[Agent] 工具列表为空")
            await websocket_send_func({
                "type": "error",
                "error": "工具列表为空，无法执行工具调用。请检查 Agent 初始化。"
            })
            return
        
        langchain_messages = self._convert_messages_to_langchain(messages)
        
        sent_done = False
        try:
            async for event in self._agent.astream_events(
                {"messages": langchain_messages},
                version="v1",
            ):
                if await self._handle_event(event, websocket_send_func):
                    sent_done = True
        except Exception as e:
            logger.error(f"[Agent] 执行失败: {e}", exc_info=True)
            await websocket_send_func({
                "type": "error",
                "error": f"Agent 执行失败: {str(e)}"
            })
            raise
        finally:
            if not sent_done:
                await websocket_send_func({"type": "done"})
    
    def _convert_messages_to_langchain(
        self,
        messages: List[Dict[str, Any]]
    ) -> List[BaseMessage]:
        """
        将消息格式转换为 LangChain 消息格式
        
        Args:
            messages: 消息列表
            
        Returns:
            LangChain 消息列表
        """
        langchain_messages = []
        
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            
            if role == "system":
                langchain_messages.append(SystemMessage(content=content))
            elif role == "user":
                langchain_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                # 处理 assistant 消息，可能包含 tool_calls
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    # 如果有 tool_calls，需要转换为 LangChain 格式
                    # 注意：LangChain 的 AIMessage 使用 tool_calls 属性
                    ai_msg = AIMessage(content=content or None)
                    # LangChain 的 tool_calls 格式不同，这里简化处理
                    # 实际使用时，LangGraph 会自动处理
                    langchain_messages.append(ai_msg)
                else:
                    langchain_messages.append(AIMessage(content=content))
            elif role == "tool":
                # 处理 tool 消息
                tool_call_id = msg.get("tool_call_id", "")
                langchain_messages.append(
                    ToolMessage(content=content, tool_call_id=tool_call_id)
                )
        
        return langchain_messages
    
    async def _handle_event(
        self,
        event: Dict[str, Any],
        websocket_send_func
    ) -> bool:
        """
        处理 LangGraph 事件并发送到 WebSocket
        
        Args:
            event: LangGraph 事件
            websocket_send_func: WebSocket 发送函数
        """
        event_name = event.get("event", "")
        event_data = event.get("data", {})
        sent_done = False
        
        try:
            
            if event_name == "on_chat_model_stream":
                # LLM 流式输出
                chunk = event_data.get("chunk")
                if chunk:
                    # chunk 可能是字符串或对象
                    if isinstance(chunk, str):
                        content = chunk
                    elif hasattr(chunk, "content"):
                        content = chunk.content
                    elif isinstance(chunk, dict):
                        content = chunk.get("content", "")
                    else:
                        content = str(chunk)
                    
                    if content:
                        await websocket_send_func({
                            "type": "content",
                            "content": content
                        })
            
            elif event_name == "on_tool_start":
                tool_name = event.get("name", "")
                tool_input = event_data.get("input", {})
                if isinstance(tool_input, str):
                    try:
                        tool_input = json.loads(tool_input)
                    except:
                        pass
                logger.info(f"[Agent] 工具: {tool_name}")
                await websocket_send_func({
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "arguments": tool_input
                })
            
            elif event_name == "on_tool_end":
                tool_name = event.get("name", "")
                tool_output = event_data.get("output", "")
                output_str = str(tool_output)
                max_output_length = 10000
                if len(output_str) > max_output_length:
                    truncated_output = output_str[:max_output_length] + f"\n\n... (已截断)"
                else:
                    truncated_output = output_str
                await websocket_send_func({
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "result": {
                        "success": True,
                        "content": truncated_output,
                        "truncated": len(output_str) > max_output_length
                    }
                })
            
            elif event_name == "on_chain_end":
                await websocket_send_func({"type": "done"})
                sent_done = True
            
            elif event_name == "on_chain_error":
                error = event_data.get("error", "未知错误")
                logger.error(f"[Agent] 错误: {error}")
                await websocket_send_func({
                    "type": "error",
                    "error": str(error)
                })
            
        except Exception as e:
            logger.error(f"[Agent] 事件处理失败: {e}")
        
        return sent_done
    

def get_langgraph_agent_service() -> LangGraphAgentService:
    """便捷方法，获取 LangGraphAgentService 单例"""
    return LangGraphAgentService.get_instance()

