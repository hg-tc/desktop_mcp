"""
MCP 客户端服务 - 与 Go 后端 MCP 服务通信
"""
import logging
from typing import Dict, List, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class McpClient:
    """MCP 客户端，用于与 Go 后端 MCP 服务通信"""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        初始化 MCP 客户端
        
        Args:
            base_url: Go 后端基础 URL，如果不提供则从配置读取
        """
        self.base_url = base_url or settings.MCP_SERVER_URL or "http://127.0.0.1:18060"
        self.mcp_endpoint = f"{self.base_url}/mcp"
        self.timeout = 30.0
        self._initialized = False  # 标记会话是否已初始化
        self._session_id: Optional[str] = None  # MCP 会话 ID（从响应头中获取）
        self._http_client: Optional[httpx.AsyncClient] = None  # 复用 HTTP 客户端以保持会话
    
    def reset_session(self) -> None:
        """
        重置会话状态（用于新的 WebSocket 连接）
        """
        logger.info("[MCP] 重置会话状态")
        self._initialized = False
        self._session_id = None
        # 注意：不关闭 HTTP 客户端，让它保持连接
        
    async def _ensure_initialized(self) -> None:
        """
        确保 MCP 会话已初始化
        根据 MCP 协议，在调用任何方法之前必须先初始化会话
        """
        if self._initialized:
            logger.debug("[MCP] 会话已初始化，跳过")
            return
        
        logger.info("[MCP] 🔄 开始初始化 MCP 会话...")
        try:
            # 发送 initialize 请求
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "clientInfo": {
                        "name": "xiaohongshu-agent-python",
                        "version": "1.0.0"
                    }
                }
            }
            
            # 创建或复用 HTTP 客户端
            if self._http_client is None:
                self._http_client = httpx.AsyncClient(timeout=self.timeout)
            
            # 发送 initialize 请求
            logger.debug(f"[MCP] 发送 initialize 请求: {payload}")
            response = await self._http_client.post(
                self.mcp_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            result = response.json()
            
            logger.debug(f"[MCP] initialize 响应: {result}")
            
            if "error" in result:
                error = result["error"]
                logger.error(f"[MCP] ❌ 初始化失败: {error}")
                raise Exception(f"MCP 初始化错误: {error.get('message', 'Unknown error')}")
            
            # 从响应头中提取会话 ID（MCP 协议要求）
            session_id = response.headers.get("Mcp-Session-Id") or response.headers.get("mcp-session-id")
            if session_id:
                self._session_id = session_id
                logger.info(f"[MCP] 获取到会话 ID: {session_id}")
            else:
                logger.warning(f"[MCP] ⚠️  响应头中未找到 Mcp-Session-Id，可能服务器不支持会话管理")
                logger.debug(f"[MCP] 响应头: {dict(response.headers)}")
            
            # 初始化成功后，发送 initialized 通知
            initialized_payload = {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            }
            
            # 如果存在会话 ID，在请求头中包含它
            initialized_headers = {"Content-Type": "application/json"}
            if self._session_id:
                initialized_headers["Mcp-Session-Id"] = self._session_id
            
            logger.debug(f"[MCP] 发送 initialized 通知: {initialized_payload}, headers: {initialized_headers}")
            initialized_response = await self._http_client.post(
                self.mcp_endpoint,
                json=initialized_payload,
                headers=initialized_headers
            )
            initialized_response.raise_for_status()
            logger.debug(f"[MCP] initialized 通知响应状态: {initialized_response.status_code}")
            
            self._initialized = True
            logger.info("[MCP] ✅ MCP 会话初始化成功")
                
        except httpx.HTTPError as e:
            logger.error(f"[MCP] HTTP 请求失败: {e}")
            raise Exception(f"无法连接到 MCP 服务: {e}")
        except Exception as e:
            logger.error(f"[MCP] 初始化异常: {e}")
            raise
    
    async def _call_mcp(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        调用 MCP 方法
        
        Args:
            method: MCP 方法名
            params: 方法参数
            
        Returns:
            MCP 响应结果
        """
        # 确保会话已初始化（除了 initialize 和 notifications/initialized 方法）
        if method not in ["initialize", "notifications/initialized"]:
            logger.info(f"[MCP] 准备调用方法: {method}, 当前初始化状态: {self._initialized}")
            if not self._initialized:
                logger.info(f"[MCP] ⚠️  会话未初始化，必须先初始化...")
                try:
                    await self._ensure_initialized()
                    logger.info(f"[MCP] ✅ 初始化完成，现在可以调用 {method}")
                except Exception as e:
                    logger.error(f"[MCP] ❌ 初始化失败，无法调用 {method}: {e}", exc_info=True)
                    raise
        
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
        }
        
        if params:
            payload["params"] = params
        
        try:
            # 使用复用的 HTTP 客户端（如果已初始化）或创建新的
            if self._http_client is None:
                self._http_client = httpx.AsyncClient(timeout=self.timeout)
            
            # 构建请求头，如果存在会话 ID，必须包含它
            headers = {"Content-Type": "application/json"}
            if self._session_id:
                headers["Mcp-Session-Id"] = self._session_id
                logger.debug(f"[MCP] 请求头中包含会话 ID: {self._session_id}")
            
            response = await self._http_client.post(
                self.mcp_endpoint,
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            result = response.json()
            
            if "error" in result:
                error = result["error"]
                logger.error(f"MCP 调用失败: {error}")
                raise Exception(f"MCP 错误: {error.get('message', 'Unknown error')}")
            
            return result.get("result", {})
                
        except httpx.HTTPError as e:
            logger.error(f"MCP HTTP 请求失败: {e}")
            raise Exception(f"无法连接到 MCP 服务: {e}")
        except Exception as e:
            logger.error(f"MCP 调用异常: {e}")
            raise
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        获取可用工具列表
        
        Returns:
            工具列表
        """
        try:
            result = await self._call_mcp("tools/list")
            return result.get("tools", [])
        except Exception as e:
            logger.error(f"获取工具列表失败: {e}")
            return []
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用 MCP 工具
        
        Args:
            tool_name: 工具名称
            arguments: 工具参数
            
        Returns:
            工具执行结果
        """
        try:
            result = await self._call_mcp("tools/call", {
                "name": tool_name,
                "arguments": arguments
            })
            return result
        except Exception as e:
            logger.error(f"调用工具 {tool_name} 失败: {e}")
            raise
    
    async def get_tool_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        获取工具 Schema
        
        Args:
            tool_name: 工具名称
            
        Returns:
            工具 Schema，如果不存在则返回 None
        """
        tools = await self.list_tools()
        for tool in tools:
            if tool.get("name") == tool_name:
                return tool
        return None
    
    async def health_check(self) -> bool:
        """
        检查 MCP 服务健康状态
        
        Returns:
            如果服务可用返回 True，否则返回 False
        """
        try:
            health_url = f"{self.base_url}/health"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(health_url)
                return response.status_code == 200
        except Exception:
            return False

