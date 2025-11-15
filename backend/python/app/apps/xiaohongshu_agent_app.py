"""
小红书 Agent 应用
集成 MCP 工具和 LLM 服务，提供智能小红书内容管理和发布助手
"""
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from openai import APIError
from app.apps.base_app import BaseApp
from app.services.mcp_client import McpClient
from app.services.llm_client_service import get_llm_client_service
from app.services.langgraph_tools import convert_mcp_tools_to_langchain
from app.services.langgraph_agent_service import get_langgraph_agent_service
from app.core.config import settings

logger = logging.getLogger(__name__)

# 全局 MCP 客户端实例
_mcp_client: Optional[McpClient] = None


def get_mcp_client() -> McpClient:
    """获取或创建 MCP 客户端"""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = McpClient()
    return _mcp_client


class XiaohongshuAgentApp(BaseApp):
    """小红书 Agent 应用"""
    
    def __init__(self):
        super().__init__(
            app_id="xiaohongshu-agent",
            app_name="小红书 Agent",
            app_description="智能小红书内容管理和发布助手，支持内容搜索、发布、互动等功能"
        )
        self.mcp_client = get_mcp_client()
        self.llm_ws_url = f"ws://{settings.HOST}:{settings.PORT}/ws"
        self.llm_client_service = get_llm_client_service()
        self.langgraph_agent_service = get_langgraph_agent_service()
        logger.info("[XiaohongshuAgentApp] 小红书 Agent 应用已初始化")
    
    def _register_routes(self):
        """注册应用路由"""
        # WebSocket 聊天端点
        @self.router.websocket("/chat")
        async def chat_endpoint(websocket: WebSocket):
            await self._handle_chat(websocket)
        
        # 获取工具列表
        @self.router.get("/tools")
        async def get_tools():
            try:
                tools = await self.mcp_client.list_tools()
                return {"tools": tools}
            except Exception as e:
                logger.error(f"获取工具列表失败: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        # 健康检查
        @self.router.get("/health")
        async def health_check():
            mcp_healthy = await self.mcp_client.health_check()
            return {
                "status": "ok" if mcp_healthy else "degraded",
                "mcp_service": "ok" if mcp_healthy else "unavailable"
            }
    
    async def _handle_chat(self, websocket: WebSocket):
        """处理 WebSocket 聊天请求"""
        await websocket.accept()
        logger.info("=" * 60)
        logger.info("🔌 小红书 Agent WebSocket 连接建立")
        logger.info("=" * 60)
        
        # 重置 MCP 客户端会话状态（每个 WebSocket 连接都需要新的会话）
        self.mcp_client.reset_session()
        
        try:
            # 获取 MCP 工具列表（如果失败，使用空列表）
            logger.info("[初始化] 步骤 1/3: 获取 MCP 工具列表...")
            try:
                mcp_tools = await self.mcp_client.list_tools()
                logger.info(f"[初始化] ✅ 获取到 {len(mcp_tools)} 个 MCP 工具")
                if mcp_tools:
                    mcp_tool_names = [tool.get("name", "unknown") for tool in mcp_tools]
                    logger.info(f"[初始化] MCP 工具名称: {', '.join(mcp_tool_names)}")
            except Exception as e:
                logger.error(f"[初始化] ❌ 获取 MCP 工具列表失败: {e}", exc_info=True)
                logger.warning(f"[初始化] ⚠️  将使用空工具列表")
                mcp_tools = []
            
            # 转换为 LangChain 工具格式
            logger.info("[初始化] 步骤 2/3: 转换为 LangChain 工具格式...")
            langchain_tools = convert_mcp_tools_to_langchain(mcp_tools, self.mcp_client)
            logger.info(f"[初始化] ✅ 工具转换完成，LangChain 工具数量: {len(langchain_tools)}")
            if langchain_tools:
                langchain_tool_names = [tool.name for tool in langchain_tools]
                logger.info(f"[初始化] LangChain 工具名称: {', '.join(langchain_tool_names)}")
            else:
                logger.warning(f"[初始化] ⚠️  工具转换后列表为空！")
                logger.warning(f"[初始化] MCP 工具数量: {len(mcp_tools)}")
                if mcp_tools:
                    logger.warning(f"[初始化] 可能原因：工具转换失败，请检查 langgraph_tools.py")
            
            # 初始化 LangGraph Agent
            logger.info("[初始化] 步骤 3/3: 初始化 LangGraph Agent...")
            try:
                self.langgraph_agent_service.initialize_agent(langchain_tools)
                logger.info(f"[初始化] ✅ Agent 已初始化，工具数量: {len(langchain_tools)}")
                logger.info("=" * 60)
            except Exception as e:
                logger.error(f"[初始化] ❌ Agent 初始化失败: {e}", exc_info=True)
                logger.info("=" * 60)
                await websocket.send_json({
                    "type": "error",
                    "error": f"Agent 初始化失败: {str(e)}"
                })
                return
            
            # 处理用户消息
            while True:
                try:
                    # 接收用户消息（设置超时，避免无限等待）
                    user_data = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)  # 5分钟超时
                    user_message = json.loads(user_data)
                except asyncio.TimeoutError:
                    # 超时，发送心跳或保持连接
                    logger.debug("WebSocket 接收超时，发送心跳")
                    await websocket.send_json({"type": "ping"})
                    continue
                except WebSocketDisconnect:
                    # 客户端正常断开
                    logger.info("客户端断开连接")
                    break
                except json.JSONDecodeError as e:
                    logger.error(f"解析消息失败: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "error": f"消息格式错误: {str(e)}"
                    })
                    continue
                except Exception as e:
                    logger.error(f"接收消息时发生错误: {e}", exc_info=True)
                    await websocket.send_json({
                        "type": "error",
                        "error": f"处理消息时发生错误: {str(e)}"
                    })
                    continue
                
                try:
                    if user_message.get("type") == "message":
                        # 构建消息历史
                        messages = user_message.get("messages", [])
                        
                        # 检查 API Key
                        if not settings.OPENAI_API_KEY:
                            await websocket.send_json({
                                "type": "error",
                                "error": "LLM API Key 未配置。请在应用设置中配置 OPENAI_API_KEY 环境变量。"
                            })
                            continue
                        
                        # 记录 API 配置信息（用于调试）
                        api_key_preview = settings.OPENAI_API_KEY[:8] + "..." + settings.OPENAI_API_KEY[-4:] if settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 12 else settings.OPENAI_API_KEY
                        logger.info(f"[LangGraph] API Key: {api_key_preview}, Base URL: {settings.OPENAI_BASE_URL}, Model: {settings.OPENAI_MODEL}")
                        logger.info(f"[LangGraph] 工具数量: {len(langchain_tools)}")
                        if langchain_tools:
                            tool_names = [tool.name for tool in langchain_tools]
                            logger.info(f"[LangGraph] 工具名称: {', '.join(tool_names)}")
                        
                        # 使用 LangGraph Agent 处理消息
                        # 定义 WebSocket 发送函数
                        async def send_to_websocket(data: Dict[str, Any]) -> None:
                            """发送数据到 WebSocket"""
                            await websocket.send_json(data)
                        
                        try:
                            # 使用 LangGraph Agent 流式处理
                            await self.langgraph_agent_service.stream_agent_response(
                                messages,
                                send_to_websocket
                            )
                        except Exception as e:
                            logger.error(f"[LangGraph] Agent 执行失败: {e}", exc_info=True)
                            await websocket.send_json({
                                "type": "error",
                                "error": f"Agent 执行失败: {str(e)}"
                            })
                    
                    elif user_message.get("type") == "close":
                        break
                except Exception as e:
                    logger.error(f"处理消息错误: {e}", exc_info=True)
                    await websocket.send_json({
                        "type": "error",
                        "error": str(e)
                    })
        
        except WebSocketDisconnect:
            logger.info("客户端断开连接")
        except Exception as e:
            logger.error(f"WebSocket 处理错误: {e}", exc_info=True)
        finally:
            logger.info("小红书 Agent WebSocket 连接关闭")
    
    def _convert_mcp_tools_to_openai(self, mcp_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """将 MCP 工具格式转换为 OpenAI 工具格式"""
        openai_tools = []
        
        for tool in mcp_tools:
            tool_name = tool.get("name", "")
            tool_description = tool.get("description", "")
            tool_input = tool.get("inputSchema", {})
            
            # MCP 的 inputSchema 是完整的 JSON Schema，OpenAI 需要的是 parameters 对象
            # 如果 inputSchema 本身就是完整的 schema，直接使用
            # 否则提取 properties 和 required
            if isinstance(tool_input, dict):
                # 如果 inputSchema 有 properties，说明是完整的 JSON Schema
                if "properties" in tool_input:
                    parameters = {
                        "type": tool_input.get("type", "object"),
                        "properties": tool_input.get("properties", {}),
                    }
                    if "required" in tool_input and tool_input["required"]:
                        parameters["required"] = tool_input["required"]
                    # 保留其他可能的字段（如 additionalProperties）
                    for key in ["additionalProperties", "anyOf", "oneOf", "allOf"]:
                        if key in tool_input:
                            parameters[key] = tool_input[key]
                else:
                    # 如果 inputSchema 没有 properties，可能已经是 parameters 格式
                    parameters = tool_input
            else:
                # 如果不是字典，使用空对象
                parameters = {"type": "object", "properties": {}}
            
            # 确保 description 不为空（这对工具调用很重要）
            if not tool_description:
                tool_description = f"执行 {tool_name} 操作"
            
            openai_tool = {
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": tool_description,
                    "parameters": parameters
                }
            }
            openai_tools.append(openai_tool)
            logger.debug(f"[工具转换] {tool_name}: description={tool_description[:50]}..., parameters keys={list(parameters.keys())}")
        
        return openai_tools
    
    async def _execute_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """执行 MCP 工具调用"""
        try:
            result = await self.mcp_client.call_tool(tool_name, arguments)
            
            # 解析 MCP 响应
            if isinstance(result, dict):
                content = result.get("content", [])
                if content and len(content) > 0:
                    # 提取文本内容
                    text_content = ""
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "text":
                            text_content += item.get("text", "")
                        elif isinstance(item, str):
                            text_content += item
                    
                    return {
                        "success": True,
                        "content": text_content if text_content else json.dumps(result)
                    }
            
            return {
                "success": True,
                "content": json.dumps(result)
            }
            
        except Exception as e:
            logger.error(f"工具调用失败 {tool_name}: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }


# 创建应用实例
APP = XiaohongshuAgentApp()


def get_app() -> XiaohongshuAgentApp:
    """获取应用实例（用于应用注册）"""
    return APP

