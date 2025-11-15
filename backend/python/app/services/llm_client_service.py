"""
LLM 客户端服务
负责统一管理与 OpenAI 兼容 API 的客户端创建、配置和缓存
"""

import json
import logging
from typing import Dict, Optional

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMClientService:
    """单例 LLM 客户端服务，负责创建和复用 AsyncOpenAI 客户端"""

    _instance: Optional["LLMClientService"] = None

    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None
        self._client_signature: Optional[str] = None
        self._cached_headers: Dict[str, str] = {}
        self._sdk_api_key: Optional[str] = None

    @classmethod
    def get_instance(cls) -> "LLMClientService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_client(self) -> AsyncOpenAI:
        """获取（或创建）AsyncOpenAI 客户端"""
        config_signature = self._build_signature()

        if self._client is None or self._client_signature != config_signature:
            logger.info("[LLMClientService] 初始化 LLM 客户端（配置发生变化或首次启动）")
            self._initialize_client(config_signature)

        return self._client  # type: ignore[return-value]

    def get_headers(self) -> Dict[str, str]:
        """获取当前生效的自定义 headers"""
        # 确保 headers 已初始化
        if not self._cached_headers:
            self._initialize_client(self._build_signature())
        return self._cached_headers

    def _build_signature(self) -> str:
        """构建配置签名，用于判断配置是否发生变化"""
        config = {
            "api_key": settings.OPENAI_API_KEY,
            "base_url": settings.OPENAI_BASE_URL,
            "auth_token": settings.LLM_AUTHORIZATION_TOKEN,
            "api_key_header": settings.LLM_API_KEY_HEADER,
            "api_key_format": settings.LLM_API_KEY_FORMAT,
            "custom_headers": settings.LLM_CUSTOM_HEADERS or "",
        }
        return json.dumps(config, sort_keys=True)

    def _initialize_client(self, signature: str) -> None:
        sdk_api_key, default_headers = self._prepare_auth_headers()
        self._sdk_api_key = sdk_api_key
        self._cached_headers = default_headers

        self._client = AsyncOpenAI(
            api_key=sdk_api_key,
            base_url=settings.OPENAI_BASE_URL,
            default_headers=default_headers or None,
        )
        self._client_signature = signature

    def _prepare_auth_headers(self) -> "tuple[Optional[str], Dict[str, str]]":
        """
        根据配置构建认证 headers
        返回：(
            sdk_api_key -> 传递给 AsyncOpenAI 构造函数的 api_key,
            headers -> default_headers
        )
        """
        headers: Dict[str, str] = {}
        api_key = settings.OPENAI_API_KEY
        header_name = (settings.LLM_API_KEY_HEADER or "Authorization").strip()
        key_format = (settings.LLM_API_KEY_FORMAT or "bearer").lower()

        sdk_api_key: Optional[str] = None

        if api_key:
            # 如果仍然使用标准 Authorization Bearer，则让 SDK 处理
            if header_name.lower() == "authorization" and key_format == "bearer":
                sdk_api_key = api_key
            else:
                value = f"Bearer {api_key}" if key_format == "bearer" else api_key
                headers[header_name] = value

        # 额外的 Authorization Token（例如某些第三方要求双重认证）
        if settings.LLM_AUTHORIZATION_TOKEN:
            headers.setdefault(
                "Authorization", f"Bearer {settings.LLM_AUTHORIZATION_TOKEN}"
            )

        # 解析自定义 headers（JSON 字符串）
        custom_headers = settings.get_llm_custom_headers()
        if custom_headers:
            headers.update(custom_headers)

        return sdk_api_key, headers


def get_llm_client_service() -> LLMClientService:
    """便捷方法，获取 LLMClientService 单例"""
    return LLMClientService.get_instance()

