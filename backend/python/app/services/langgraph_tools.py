"""
MCP 工具包装器 - 将 MCP 工具转换为 LangChain Tool 格式
"""
import json
import logging
from typing import Dict, List, Any, Optional
from langchain_core.tools import tool, BaseTool, StructuredTool
from langchain_core.callbacks import CallbackManagerForToolRun
from pydantic import BaseModel, Field

from app.services.mcp_client import McpClient

logger = logging.getLogger(__name__)


def extract_text_content(mcp_result: Dict[str, Any], max_length: int = 50000) -> str:
    """
    从 MCP 工具结果中提取文本内容
    
    Args:
        mcp_result: MCP 工具返回的结果
        max_length: 最大文本长度，超过此长度将截断（默认 50KB）
        
    Returns:
        提取的文本内容
    """
    if isinstance(mcp_result, dict):
        content = mcp_result.get("content", [])
        if content and len(content) > 0:
            # 提取文本内容
            text_content = ""
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_content += item.get("text", "")
                elif isinstance(item, str):
                    text_content += item
                
                # 如果内容已经很大，提前截断
                if len(text_content) > max_length:
                    logger.warning(f"[MCP工具] 工具返回内容过大 ({len(text_content)} 字符)，截断到 {max_length} 字符")
                    text_content = text_content[:max_length] + f"\n\n... (内容已截断，原始长度: {len(text_content)} 字符)"
                    break
            
            if text_content:
                return text_content
    
    # 如果没有文本内容，返回 JSON 字符串
    json_str = json.dumps(mcp_result, ensure_ascii=False)
    if len(json_str) > max_length:
        logger.warning(f"[MCP工具] JSON 结果过大 ({len(json_str)} 字符)，截断到 {max_length} 字符")
        return json_str[:max_length] + f"\n\n... (JSON 已截断，原始长度: {len(json_str)} 字符)"
    return json_str


def create_mcp_tool_function(mcp_tool: Dict[str, Any], mcp_client: McpClient):
    """
    为 MCP 工具创建异步函数
    
    Args:
        mcp_tool: MCP 工具定义
        mcp_client: MCP 客户端实例
        
    Returns:
        异步工具函数
    """
    tool_name = mcp_tool.get("name", "")
    tool_description = mcp_tool.get("description", "")
    input_schema = mcp_tool.get("inputSchema", {})
    
    # 确保 description 不为空
    if not tool_description:
        tool_description = f"执行 {tool_name} 操作"
    
    # 从 inputSchema 提取参数信息
    properties = input_schema.get("properties", {}) if isinstance(input_schema, dict) else {}
    required = input_schema.get("required", []) if isinstance(input_schema, dict) else []
    
    # 创建动态的 Pydantic 模型类
    field_definitions = {}
    for prop_name, prop_schema in properties.items():
        if not isinstance(prop_schema, dict):
            continue
        prop_type = prop_schema.get("type", "string")
        prop_desc = prop_schema.get("description", "")
        
        # 转换 JSON Schema 类型到 Python 类型
        if prop_type == "string":
            python_type = str
        elif prop_type == "integer":
            python_type = int
        elif prop_type == "number":
            python_type = float
        elif prop_type == "boolean":
            python_type = bool
        elif prop_type == "array":
            python_type = list
        else:
            python_type = str
        
        # 创建 Field
        if prop_name in required:
            field_definitions[prop_name] = (python_type, Field(description=prop_desc))
        else:
            field_definitions[prop_name] = (Optional[python_type], Field(default=None, description=prop_desc))
    
    # 创建 Pydantic 模型（如果没有参数，创建一个空的模型）
    if field_definitions:
        ArgsModel = type(f"{tool_name}Args", (BaseModel,), {
            "__annotations__": {k: v[0] for k, v in field_definitions.items()},
            **{k: v[1] for k, v in field_definitions.items()}
        })
    else:
        # 无参数工具，创建一个空的模型
        ArgsModel = type(f"{tool_name}Args", (BaseModel,), {})
    
    # 创建异步工具函数
    async def tool_func(**kwargs) -> str:
        """工具执行函数"""
        try:
            logger.debug(f"[MCP工具] 调用工具: {tool_name}, 参数: {json.dumps(kwargs, ensure_ascii=False)}")
            
            # 调用 MCP 工具
            result = await mcp_client.call_tool(tool_name, kwargs)
            
            # 提取文本内容
            text_content = extract_text_content(result)
            
            logger.debug(f"[MCP工具] 工具 {tool_name} 执行完成，结果长度: {len(text_content)}")
            
            return text_content
            
        except Exception as e:
            logger.error(f"[MCP工具] 工具 {tool_name} 执行失败: {e}", exc_info=True)
            return f"工具执行失败: {str(e)}"
    
    # 使用 StructuredTool 创建工具，支持异步函数
    return StructuredTool.from_function(
        coroutine=tool_func,  # 使用 coroutine 参数支持异步函数
        name=tool_name,
        description=tool_description,
        args_schema=ArgsModel
    )


def convert_mcp_tools_to_langchain(
    mcp_tools: List[Dict[str, Any]],
    mcp_client: McpClient
) -> List[BaseTool]:
    """
    将 MCP 工具列表转换为 LangChain Tool 列表
    
    Args:
        mcp_tools: MCP 工具列表
        mcp_client: MCP 客户端实例
        
    Returns:
        LangChain Tool 列表
    """
    langchain_tools = []
    
    for mcp_tool in mcp_tools:
        try:
            tool_wrapper = create_mcp_tool_function(mcp_tool, mcp_client)
            langchain_tools.append(tool_wrapper)
            tool_name = mcp_tool.get('name', 'unknown')
            logger.info(f"[工具转换] ✅ 已转换工具: {tool_name}")
            logger.debug(f"  描述: {tool_wrapper.description[:100]}...")
            # 检查工具是否有 args_schema
            if hasattr(tool_wrapper, 'args_schema') and tool_wrapper.args_schema:
                try:
                    schema = tool_wrapper.args_schema.schema() if hasattr(tool_wrapper.args_schema, 'schema') else None
                    if schema:
                        logger.debug(f"  参数: {list(schema.get('properties', {}).keys())}")
                except:
                    pass
        except Exception as e:
            logger.error(f"[工具转换] ❌ 转换工具失败 {mcp_tool.get('name')}: {e}", exc_info=True)
    
    logger.info(f"[工具转换] 成功转换 {len(langchain_tools)}/{len(mcp_tools)} 个工具")
    
    if not langchain_tools:
        logger.warning("[工具转换] ⚠️  没有成功转换任何工具！Agent 将无法调用工具。")
    
    return langchain_tools

