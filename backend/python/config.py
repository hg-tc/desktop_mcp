"""配置管理模块"""
import os
from typing import Optional


class Config:
    """应用配置"""
    
    # WebSocket 服务器配置
    WS_HOST: str = os.getenv("LLM_WS_HOST", "127.0.0.1")
    WS_PORT: int = int(os.getenv("LLM_WS_PORT", "18061"))
    
    # OpenAI 兼容 API 配置（从环境变量读取，由 Electron 主进程设置）
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL: Optional[str] = os.getenv("OPENAI_BASE_URL")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    # 请求配置
    DEFAULT_TEMPERATURE: float = 0.3
    DEFAULT_TIMEOUT: int = 120  # 秒
    DEFAULT_MAX_RETRIES: int = 2
    
    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def validate(cls) -> bool:
        """验证配置是否完整"""
        if not cls.OPENAI_API_KEY:
            return False
        if not cls.OPENAI_BASE_URL:
            return False
        return True
    
    @classmethod
    def get_ws_url(cls) -> str:
        """获取 WebSocket 服务器 URL"""
        return f"ws://{cls.WS_HOST}:{cls.WS_PORT}"

