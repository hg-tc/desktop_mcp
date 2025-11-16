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
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
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
        if not tools:
            logger.warning("[LangGraphAgent] ⚠️  没有提供工具，Agent 将无法调用工具")
            self._tools = []
        else:
            self._tools = tools
            logger.info(f"[LangGraphAgent] ✅ 初始化 Agent，工具数量: {len(tools)}")
            logger.info(f"[LangGraphAgent] 工具名称列表: {[tool.name for tool in tools]}")
        
        # 创建 LangChain ChatOpenAI 客户端
        # 需要从 LLMClientService 获取配置
        llm_service = get_llm_client_service()
        headers = llm_service.get_headers()
        
        # 构建 ChatOpenAI 客户端
        # LangChain 的 ChatOpenAI 支持自定义 headers
        model_kwargs = {}
        if headers:
            model_kwargs["default_headers"] = headers
        
        # 获取 API Key（如果使用标准 Authorization，则直接传递）
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY 未配置")
        
        # 创建 ChatOpenAI 实例
        llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            base_url=settings.OPENAI_BASE_URL,
            api_key=api_key,
            temperature=0.3,
            timeout=settings.LLM_REQUEST_TIMEOUT,
            **model_kwargs
        )
        
        # 验证 LLM 是否支持工具调用
        logger.info(f"[LangGraphAgent] LLM 类型: {type(llm)}")
        logger.info(f"[LangGraphAgent] LLM 模型: {settings.OPENAI_MODEL}")
        
        # 手动绑定工具到 LLM（确保工具被正确识别）
        # 注意：create_react_agent 应该会自动绑定，但某些情况下可能需要手动绑定
        if self._tools:
            try:
                logger.info(f"[LangGraphAgent] 手动绑定 {len(self._tools)} 个工具到 LLM...")
                llm_with_tools = llm.bind_tools(self._tools)
                logger.info(f"[LangGraphAgent] ✅ 工具已绑定到 LLM")
                llm = llm_with_tools
            except Exception as e:
                logger.warning(f"[LangGraphAgent] 手动绑定工具失败，将使用原始 LLM: {e}")
                # 继续使用原始 LLM，让 create_react_agent 处理
        
        # 检查工具是否可以被 LLM 识别（测试工具格式）
        if self._tools:
            try:
                # 尝试获取工具的 JSON Schema（用于 function calling）
                for tool in self._tools:
                    if hasattr(tool, 'args_schema'):
                        schema = tool.args_schema.schema() if hasattr(tool.args_schema, 'schema') else None
                        logger.debug(f"[LangGraphAgent] 工具 {tool.name} 的 Schema: {schema}")
            except Exception as e:
                logger.warning(f"[LangGraphAgent] 检查工具 Schema 时出错: {e}")
        
        # 记录工具详细信息
        if self._tools:
            logger.info(f"[LangGraphAgent] 工具列表:")
            for i, tool in enumerate(self._tools, 1):
                logger.info(f"  {i}. {tool.name}: {tool.description[:100]}...")
                # 检查工具是否有 args_schema
                if hasattr(tool, 'args_schema') and tool.args_schema:
                    logger.debug(f"     参数 Schema: {tool.args_schema.schema() if hasattr(tool.args_schema, 'schema') else tool.args_schema}")
        else:
            logger.warning("[LangGraphAgent] ⚠️  没有工具传递给 Agent！")
        
        # 验证工具格式 - 确保工具可以被 LangChain 识别
        if self._tools:
            logger.info(f"[LangGraphAgent] 验证工具格式...")
            for tool in self._tools:
                # 检查工具是否有必要的方法
                if not hasattr(tool, 'name'):
                    logger.error(f"[LangGraphAgent] 工具缺少 'name' 属性: {tool}")
                if not hasattr(tool, 'description'):
                    logger.error(f"[LangGraphAgent] 工具缺少 'description' 属性: {tool}")
                if not hasattr(tool, 'invoke') and not hasattr(tool, 'ainvoke'):
                    logger.error(f"[LangGraphAgent] 工具缺少 'invoke' 或 'ainvoke' 方法: {tool}")
                
                # 尝试获取工具的 JSON Schema（用于 function calling）
                try:
                    if hasattr(tool, 'args_schema') and tool.args_schema:
                        schema = tool.args_schema.schema() if hasattr(tool.args_schema, 'schema') else None
                        logger.info(f"[LangGraphAgent] 工具 {tool.name} 的 Schema 类型: {type(schema)}")
                        if schema:
                            logger.debug(f"[LangGraphAgent] 工具 {tool.name} 的 Schema: {json.dumps(schema, ensure_ascii=False)[:200]}")
                except Exception as e:
                    logger.warning(f"[LangGraphAgent] 获取工具 {tool.name} 的 Schema 时出错: {e}")
        
        # 创建 Agent
        # LangChain 1.0: 使用 create_agent，支持 system_prompt 参数
        # 向后兼容: 如果使用旧版本，使用 create_react_agent 和 prompt 参数
        try:
            # 检查 LLM 是否已经绑定了工具
            if hasattr(llm, 'bound_tools'):
                logger.info(f"[LangGraphAgent] LLM 已绑定工具，工具数量: {len(llm.bound_tools) if llm.bound_tools else 0}")
            elif hasattr(llm, 'lc_kwargs') and 'tools' in llm.lc_kwargs:
                logger.info(f"[LangGraphAgent] LLM 已通过 lc_kwargs 绑定工具")
            
            if LANGCHAIN_1_0:
                # LangChain 1.0: 使用 create_agent，传递 system_prompt
                # 注意：LangChain 1.0 的 create_agent 可能需要不同的参数结构
                try:
                    # 尝试使用 system_prompt 参数（LangChain 1.0 标准方式）
                    self._agent = create_agent(
                        model=llm,
                        tools=self._tools if not hasattr(llm, 'bound_tools') else [],
                        system_prompt=self._system_prompt
                    )
                    logger.info(f"[LangGraphAgent] ✅ Agent 创建成功（LangChain 1.0 模式）")
                except TypeError:
                    # 如果 system_prompt 不支持，尝试 prompt 参数
                    try:
                        self._agent = create_agent(
                            model=llm,
                            tools=self._tools if not hasattr(llm, 'bound_tools') else [],
                            prompt=self._system_prompt
                        )
                        logger.info(f"[LangGraphAgent] ✅ Agent 创建成功（使用 prompt 参数）")
                    except TypeError as e:
                        # 如果都不支持，尝试不传递 prompt（使用默认）
                        logger.warning(f"[LangGraphAgent] ⚠️  system_prompt 和 prompt 参数都不支持，尝试不传递: {e}")
                        self._agent = create_agent(
                            model=llm,
                            tools=self._tools if not hasattr(llm, 'bound_tools') else []
                        )
                        logger.info(f"[LangGraphAgent] ✅ Agent 创建成功（使用默认 prompt）")
            else:
                # 向后兼容：使用 create_react_agent（旧版本）
                self._agent = create_agent(
                    llm,
                    tools=self._tools if not hasattr(llm, 'bound_tools') else [],
                    prompt=self._system_prompt
                )
                logger.info(f"[LangGraphAgent] ✅ Agent 创建成功（向后兼容模式）")
        except Exception as e:
            logger.error(f"[LangGraphAgent] ❌ Agent 创建失败: {e}", exc_info=True)
            raise
        
        logger.info(f"[LangGraphAgent] Agent 初始化完成，模型: {settings.OPENAI_MODEL}, Base URL: {settings.OPENAI_BASE_URL}")
        logger.info(f"[LangGraphAgent] Agent 类型: {type(self._agent)}")
        
        # 验证 Agent 的图结构
        if hasattr(self._agent, 'nodes'):
            logger.info(f"[LangGraphAgent] Agent 节点: {list(self._agent.nodes.keys())}")
        if hasattr(self._agent, 'edges'):
            logger.debug(f"[LangGraphAgent] Agent 边: {list(self._agent.edges)}")
    
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
        
        # 检查工具列表
        if not self._tools:
            logger.warning(f"[LangGraphAgent] ⚠️  工具列表为空！无法执行工具调用。")
            logger.warning(f"[LangGraphAgent] 请确保在调用 stream_agent_response 之前已正确初始化 Agent 并传入工具列表。")
            await websocket_send_func({
                "type": "error",
                "error": "工具列表为空，无法执行工具调用。请检查 Agent 初始化。"
            })
            return
        
        logger.info(f"[LangGraphAgent] 当前工具列表: {[tool.name for tool in self._tools]}")
        
        # 转换消息格式为 LangChain 消息
        langchain_messages = self._convert_messages_to_langchain(messages)
        
        logger.debug(f"[LangGraphAgent] 开始执行 Agent，消息数量: {len(langchain_messages)}")
        
        # 使用 astream_events 获取流式响应
        # 支持多轮交互：如果检测到 JSON 文本，执行工具后继续 Agent 循环
        max_iterations = 5  # 最大迭代次数，避免无限循环
        iteration = 0
        current_messages = langchain_messages
        json_tool_result = None  # 存储从 JSON 解析的工具执行结果
        
        while iteration < max_iterations:
            iteration += 1
            logger.info(f"[LangGraphAgent] 开始第 {iteration} 轮 Agent 执行...")
            
            try:
                event_count = 0
                tool_call_events = []
                last_output = None  # 存储最后一次 LLM 输出
                
                # 只处理重要的事件类型，过滤掉大量调试事件
                important_event_types = {
                    "on_chat_model_stream",  # LLM 流式输出
                    "on_chat_model_end",     # LLM 输出完成
                    "on_tool_start",         # 工具开始
                    "on_tool_end",           # 工具结束
                    "on_tool_error",         # 工具错误
                    "on_chain_end",          # Agent 完成
                    "on_chain_error"         # Agent 错误
                }
                
                # LangChain 1.0: astream_events 的 API 应该保持兼容
                # 输入格式仍然是 {"messages": current_messages}
                async for event in self._agent.astream_events(
                    {"messages": current_messages},
                    version="v2"
                ):
                    event_type = event.get("event", "")
                    event_name = event.get("name", "")
                    
                    # 只处理重要事件，跳过大量调试事件（如 on_chain_start, on_chain_stream 等）
                    if event_type not in important_event_types:
                        # 只记录关键节点的事件
                        if event_type == "on_chain_start" and "agent" in event_name.lower():
                            logger.debug(f"[LangGraphAgent] Agent 开始执行: {event_name}")
                        continue
                    
                    event_count += 1
                    
                    # 特别关注工具相关事件
                    if event_type in ["on_tool_start", "on_tool_end", "on_tool_error"]:
                        tool_call_events.append(event_type)
                        logger.info(f"[LangGraphAgent] 🔧 工具事件 #{event_count}: type={event_type}, name={event_name}")
                    
                    # 保存最后一次 LLM 输出，用于检测 JSON
                    if event_type == "on_chat_model_end":
                        last_output = event.get("data", {}).get("output")
                    
                    # 只记录重要事件的详细信息
                    if event_type in ["on_tool_start", "on_tool_end", "on_chat_model_end", "on_chain_end"]:
                        logger.debug(f"[LangGraphAgent] 事件 #{event_count}: type={event_type}, name={event_name}")
                    
                    await self._handle_event(event, websocket_send_func)
                
                # 检查是否有工具调用
                if tool_call_events:
                    logger.info(f"[LangGraphAgent] ✅ 检测到 {len(tool_call_events)} 个工具调用事件")
                    # 有工具调用，继续下一轮（Agent 会自动处理工具结果）
                    break
                
                # 如果没有工具调用，检查是否返回了 JSON 文本
                if last_output:
                    content = getattr(last_output, "content", None) or (last_output.get("content") if isinstance(last_output, dict) else None)
                    if content and isinstance(content, str) and content.strip().startswith("{"):
                        logger.warning(f"[LangGraphAgent] ⚠️  第 {iteration} 轮：LLM 返回了 JSON 文本而不是 tool_calls")
                        logger.info(f"[LangGraphAgent] 🔄 尝试解析 JSON 并转换为工具调用...")
                        
                        # 尝试解析 JSON 并执行工具
                        json_tool_result = await self._parse_and_execute_json_tool(content, websocket_send_func)
                        
                        if json_tool_result:
                            # 工具执行成功，将结果添加到消息中，继续下一轮
                            from langchain_core.messages import ToolMessage
                            tool_message = ToolMessage(
                                content=json_tool_result.get("content", ""),
                                tool_call_id=f"json_tool_{iteration}"
                            )
                            current_messages = list(current_messages) + [tool_message]
                            logger.info(f"[LangGraphAgent] ✅ 工具执行成功，继续第 {iteration + 1} 轮 Agent 执行...")
                            continue  # 继续下一轮
                        else:
                            # 无法解析或执行工具，结束
                            logger.warning(f"[LangGraphAgent] ⚠️  无法从 JSON 解析工具调用，结束 Agent 执行")
                            break
                
                # 没有工具调用，也没有 JSON，正常结束
                logger.info(f"[LangGraphAgent] Agent 执行完成（无工具调用）")
                break
                
            except Exception as e:
                logger.error(f"[LangGraphAgent] Agent 执行失败: {e}", exc_info=True)
                await websocket_send_func({
                    "type": "error",
                    "error": f"Agent 执行失败: {str(e)}"
                })
                raise
            
            logger.info(f"[LangGraphAgent] 第 {iteration} 轮执行完成，共处理 {event_count} 个事件")
        
        if iteration >= max_iterations:
            logger.warning(f"[LangGraphAgent] ⚠️  达到最大迭代次数 {max_iterations}，停止执行")
    
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
    ) -> None:
        """
        处理 LangGraph 事件并发送到 WebSocket
        
        Args:
            event: LangGraph 事件
            websocket_send_func: WebSocket 发送函数
        """
        event_name = event.get("event", "")
        event_data = event.get("data", {})
        
        # 记录所有事件类型用于调试
        if event_name not in ["on_chat_model_stream", "on_tool_start", "on_tool_end", "on_chain_end", "on_chain_error", "on_chat_model_end"]:
            logger.debug(f"[LangGraphAgent] 未处理的事件类型: {event_name}, 完整事件: {json.dumps(event, default=str, ensure_ascii=False)[:500]}")
        
        try:
            if event_name == "on_chat_model_end":
                # LLM 响应完成，检查是否有 tool_calls
                output = event_data.get("output")
                if output:
                    # 检查是否有 tool_calls
                    if hasattr(output, "tool_calls") and output.tool_calls:
                        logger.info(f"[LangGraphAgent] ✅ 检测到 tool_calls: {output.tool_calls}")
                    elif isinstance(output, dict) and "tool_calls" in output:
                        logger.info(f"[LangGraphAgent] ✅ 检测到 tool_calls: {output['tool_calls']}")
                    elif hasattr(output, "additional_kwargs") and output.additional_kwargs.get("tool_calls"):
                        logger.info(f"[LangGraphAgent] ✅ 检测到 tool_calls (在 additional_kwargs 中): {output.additional_kwargs['tool_calls']}")
                    else:
                        # 检查响应内容 - JSON 文本的处理已在 stream_agent_response 中统一处理
                        content = getattr(output, "content", None) or (output.get("content") if isinstance(output, dict) else None)
                        if content and isinstance(content, str) and content.strip().startswith("{"):
                            logger.debug(f"[LangGraphAgent] 检测到 JSON 文本（将在 stream_agent_response 中处理）: {content[:100]}...")
            
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
                # 工具开始执行
                tool_name = event.get("name", "")
                tool_input = event_data.get("input", {})
                
                # 如果 input 是字符串，尝试解析为 JSON
                if isinstance(tool_input, str):
                    try:
                        tool_input = json.loads(tool_input)
                    except:
                        pass
                
                logger.info(f"[LangGraphAgent] 工具开始执行: {tool_name}, 参数: {json.dumps(tool_input, ensure_ascii=False)}")
                
                await websocket_send_func({
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "arguments": tool_input
                })
            
            elif event_name == "on_tool_end":
                # 工具执行完成
                tool_name = event.get("name", "")
                tool_output = event_data.get("output", "")
                output_str = str(tool_output)
                output_length = len(output_str)
                
                logger.info(f"[LangGraphAgent] 工具执行完成: {tool_name}, 结果长度: {output_length}")
                
                # 如果输出太大，截断并提示
                max_output_length = 10000  # 最大输出长度（10KB）
                if output_length > max_output_length:
                    logger.warning(f"[LangGraphAgent] ⚠️  工具输出过大 ({output_length} 字符)，将截断到 {max_output_length} 字符")
                    truncated_output = output_str[:max_output_length] + f"\n\n... (已截断，原始长度: {output_length} 字符)"
                else:
                    truncated_output = output_str
                
                # 发送工具结果（可选，前端可能不需要）
                await websocket_send_func({
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "result": {
                        "success": True,
                        "content": truncated_output,
                        "truncated": output_length > max_output_length,
                        "original_length": output_length
                    }
                })
            
            elif event_name == "on_chain_end":
                # Agent 执行完成
                logger.debug("[LangGraphAgent] Agent 执行完成")
                await websocket_send_func({
                    "type": "done"
                })
            
            elif event_name == "on_chain_error":
                # Agent 执行出错
                error = event_data.get("error", "未知错误")
                logger.error(f"[LangGraphAgent] Agent 执行出错: {error}")
                await websocket_send_func({
                    "type": "error",
                    "error": str(error)
                })
            
            # 忽略其他事件类型（如 on_chain_start 等）
            
        except Exception as e:
            logger.error(f"[LangGraphAgent] 处理事件失败: {e}, 事件: {event_name}", exc_info=True)
    
    async def _parse_and_execute_json_tool(
        self,
        json_content: str,
        websocket_send_func
    ) -> Optional[Dict[str, Any]]:
        """
        解析 JSON 文本并执行工具调用（用于不支持 function calling 的 LLM）
        
        Args:
            json_content: JSON 文本内容
            websocket_send_func: WebSocket 发送函数
            
        Returns:
            工具执行结果，如果成功返回 {"content": "..."}，失败返回 None
        """
        try:
            json_data = json.loads(json_content.strip())
            # 根据 JSON 内容推断应该调用哪个工具
            tool_name = None
            tool_args = {}
            
            if "keyword" in json_data:
                tool_name = "search_feeds"
                tool_args = {"keyword": json_data["keyword"]}
            elif "feed_id" in json_data:
                tool_name = "get_feed_detail"
                tool_args = {"feed_id": json_data["feed_id"]}
            elif "query" in json_data:
                tool_name = "search_feeds"
                tool_args = {"keyword": json_data["query"]}
            
            if tool_name:
                # 检查工具是否存在
                available_tool_names = [tool.name for tool in self._tools]
                logger.info(f"[LangGraphAgent] 推断的工具名称: {tool_name}")
                logger.info(f"[LangGraphAgent] 可用工具列表: {available_tool_names}")
                
                if tool_name in available_tool_names:
                    logger.info(f"[LangGraphAgent] ✅ 从 JSON 推断出工具调用: {tool_name} with args: {tool_args}")
                    # 执行工具
                    result = await self._execute_tool_from_json(tool_name, tool_args, websocket_send_func)
                    return result
                else:
                    logger.warning(f"[LangGraphAgent] ⚠️  推断的工具名称 '{tool_name}' 不在可用工具列表中")
                    logger.warning(f"[LangGraphAgent] 可用工具: {available_tool_names}")
                    # 尝试模糊匹配（例如 search_feeds vs searchFeeds）
                    for available_tool in self._tools:
                        if available_tool.name.lower() == tool_name.lower() or \
                           available_tool.name.replace("_", "").lower() == tool_name.replace("_", "").lower():
                            logger.info(f"[LangGraphAgent] 🔄 找到模糊匹配的工具: {available_tool.name}")
                            result = await self._execute_tool_from_json(available_tool.name, tool_args, websocket_send_func)
                            return result
            else:
                logger.warning(f"[LangGraphAgent] ⚠️  无法从 JSON 推断出工具名称: {json_data}")
                logger.info(f"[LangGraphAgent] JSON 键: {list(json_data.keys())}")
                logger.info(f"[LangGraphAgent] 可用工具: {[tool.name for tool in self._tools]}")
                return None
        except json.JSONDecodeError as e:
            logger.warning(f"[LangGraphAgent] ⚠️  JSON 解析失败: {e}")
            return None
        except Exception as e:
            logger.error(f"[LangGraphAgent] ❌ 处理 JSON 工具调用时出错: {e}", exc_info=True)
            return None
    
    async def _execute_tool_from_json(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        websocket_send_func
    ) -> Optional[Dict[str, Any]]:
        """
        从 JSON 解析的工具调用手动执行工具（用于不支持 function calling 的 LLM）
        
        Args:
            tool_name: 工具名称
            tool_args: 工具参数
            websocket_send_func: WebSocket 发送函数
            
        Returns:
            工具执行结果，格式：{"content": "..."}，失败返回 None
        """
        try:
            # 查找对应的工具
            tool = None
            for t in self._tools:
                if t.name == tool_name:
                    tool = t
                    break
            
            if not tool:
                logger.error(f"[LangGraphAgent] ❌ 找不到工具: {tool_name}")
                await websocket_send_func({
                    "type": "error",
                    "error": f"找不到工具: {tool_name}"
                })
                return None
            
            # 发送工具调用开始事件
            await websocket_send_func({
                "type": "tool_call",
                "tool_name": tool_name,
                "arguments": tool_args
            })
            
            # 执行工具
            logger.info(f"[LangGraphAgent] 🔧 执行工具: {tool_name}, 参数: {json.dumps(tool_args, ensure_ascii=False)}")
            
            if hasattr(tool, "ainvoke"):
                result = await tool.ainvoke(tool_args)
            elif hasattr(tool, "invoke"):
                result = tool.invoke(tool_args)
            else:
                raise ValueError(f"工具 {tool_name} 没有 invoke 或 ainvoke 方法")
            
            # 发送工具执行完成事件
            await websocket_send_func({
                "type": "tool_call",
                "tool_name": tool_name,
                "result": {
                    "success": True,
                    "content": str(result)
                }
            })
            
            logger.info(f"[LangGraphAgent] ✅ 工具执行完成: {tool_name}, 结果长度: {len(str(result))}")
            
            # 返回结果，供 Agent 继续处理
            return {"content": str(result)}
            
        except Exception as e:
            logger.error(f"[LangGraphAgent] ❌ 工具执行失败: {tool_name}, 错误: {e}", exc_info=True)
            await websocket_send_func({
                "type": "tool_call",
                "tool_name": tool_name,
                "result": {
                    "success": False,
                    "error": str(e)
                }
            })
            return None


def get_langgraph_agent_service() -> LangGraphAgentService:
    """便捷方法，获取 LangGraphAgentService 单例"""
    return LangGraphAgentService.get_instance()

