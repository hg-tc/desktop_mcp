"""
应用配置 - 适配桌面应用
"""
import os
import json
from typing import Dict, List, Optional, Union
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# 确定 .env 文件路径
# 优先查找当前文件所在目录的 .env，然后查找项目根目录
_config_dir = Path(__file__).parent.parent.parent  # app/core -> app -> python
_env_paths = [
    _config_dir / ".env",  # backend/python/.env
    _config_dir.parent / ".env",  # 项目根目录/.env
]

# 加载第一个找到的 .env 文件
_env_loaded = False
_env_file_used = None
for env_path in _env_paths:
    if env_path.exists():
        load_dotenv(env_path, override=False)  # override=False 让环境变量优先
        _env_loaded = True
        _env_file_used = str(env_path)
        break

# 如果都没找到，尝试默认行为（当前工作目录）
if not _env_loaded:
    load_dotenv(override=False)
    _env_file_used = "current working directory"

# 调试日志（始终记录，帮助诊断问题）
import logging
logger = logging.getLogger(__name__)
logger.info(f"📁 加载 .env 文件: {_env_file_used}")
api_key_from_env = os.getenv('OPENAI_API_KEY')
if api_key_from_env:
    logger.info(f"✅ OPENAI_API_KEY 已从环境变量读取 (长度: {len(api_key_from_env)})")
else:
    logger.warning("⚠️ OPENAI_API_KEY 未在环境变量中找到")


def get_user_data_path() -> str:
    """获取应用数据目录路径"""
    # 优先使用环境变量（Electron 会设置）
    user_data = os.getenv("USER_DATA_PATH")
    if user_data:
        return user_data
    
    # 开发环境：使用项目目录
    project_root = Path(__file__).parent.parent.parent.parent
    return str(project_root / "data")


class Settings(BaseSettings):
    """应用设置"""
    
    # 项目信息
    PROJECT_NAME: str = "Xiaohongshu Agent Desktop API"
    PROJECT_DESCRIPTION: str = "小红书 Agent 桌面应用后端API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # 服务器配置
    HOST: str = "127.0.0.1"
    PORT: int = 18061
    DEBUG: bool = os.getenv("NODE_ENV") != "production"
    
    # 数据库配置
    # 默认使用 SQLite，如果设置了 DATABASE_URL 则使用指定的数据库
    _user_data = get_user_data_path()
    _default_db_path = os.path.join(_user_data, "app.db")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite+aiosqlite:///{_default_db_path}"
    )
    
    # 文件上传配置
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    UPLOAD_DIR: str = os.path.join(_user_data, "uploads")
    ALLOWED_EXTENSIONS: List[str] = [
        ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
        ".txt", ".md", ".json", ".csv", ".jpg", ".jpeg", ".png", ".gif"
    ]
    
    # 大模型API配置
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    LLM_AUTHORIZATION_TOKEN: Optional[str] = os.getenv("LLM_AUTHORIZATION_TOKEN")
    LLM_API_KEY_HEADER: str = os.getenv("LLM_API_KEY_HEADER", "Authorization")
    LLM_API_KEY_FORMAT: str = os.getenv("LLM_API_KEY_FORMAT", "bearer")
    LLM_CUSTOM_HEADERS: Optional[str] = os.getenv("LLM_CUSTOM_HEADERS")
    
    # 超时配置
    API_TIMEOUT: int = int(os.getenv("API_TIMEOUT", "300"))
    LLM_REQUEST_TIMEOUT: int = int(os.getenv("LLM_REQUEST_TIMEOUT", "120"))
    
    # LangGraph Agent 配置
    LANGGRAPH_MAX_ITERATIONS: int = int(os.getenv("LANGGRAPH_MAX_ITERATIONS", "10"))  # Agent 最大迭代次数
    
    # Go MCP 后端配置
    MCP_SERVER_URL: Optional[str] = os.getenv("MCP_SERVER_URL")  # Go 后端地址
    
    # CORS配置（允许 Electron 前端访问）
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite 开发服务器
        "http://127.0.0.1:5173",
        "file://",  # Electron 本地文件协议
    ]
    
    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @property
    def user_data_path(self) -> str:
        """获取应用数据目录"""
        return get_user_data_path()
    
    @property
    def database_path(self) -> str:
        """获取数据库文件路径（仅 SQLite）"""
        if "sqlite" in self.DATABASE_URL:
            # 从 URL 中提取路径
            url = self.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
            return url
        return ""
    
    def ensure_directories(self):
        """确保必要的目录存在"""
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)
        os.makedirs(os.path.join(self.UPLOAD_DIR, "workspaces"), exist_ok=True)
        os.makedirs(os.path.join(self.UPLOAD_DIR, "global"), exist_ok=True)
        os.makedirs(os.path.dirname(self.database_path) if self.database_path else self.user_data_path, exist_ok=True)
    
    def get_llm_custom_headers(self) -> Dict[str, str]:
        """解析 LLM 自定义 headers"""
        if not self.LLM_CUSTOM_HEADERS:
            return {}
        try:
            parsed = json.loads(self.LLM_CUSTOM_HEADERS)
            if not isinstance(parsed, dict):
                logger.warning("LLM_CUSTOM_HEADERS 必须是 JSON 对象")
                return {}
            headers: Dict[str, str] = {}
            for key, value in parsed.items():
                headers[str(key)] = str(value)
            return headers
        except json.JSONDecodeError as e:
            logger.warning(f"解析 LLM_CUSTOM_HEADERS 失败: {e}")
            return {}
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# 确保必要的目录存在
settings.ensure_directories()

# 确保 OpenAI 相关环境变量
if settings.OPENAI_API_KEY:
    os.environ.setdefault("OPENAI_API_KEY", settings.OPENAI_API_KEY)
if settings.OPENAI_BASE_URL:
    os.environ.setdefault("OPENAI_BASE_URL", settings.OPENAI_BASE_URL)

