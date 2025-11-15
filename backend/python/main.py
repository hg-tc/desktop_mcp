"""LLM 后端服务入口"""
import logging
import sys
import uvicorn

# 处理导入路径
try:
    from .config import Config
    from .server import app
except ImportError:
    # 如果作为脚本直接运行，使用绝对导入
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from config import Config
    from server import app

# 配置日志
logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)


def main():
    """主函数"""
    # 验证配置
    if not Config.validate():
        logger.error("配置验证失败：请设置 OPENAI_API_KEY 和 OPENAI_BASE_URL 环境变量")
        sys.exit(1)
    
    logger.info(f"启动 LLM 后端服务: {Config.WS_HOST}:{Config.WS_PORT}")
    logger.info(f"OpenAI Base URL: {Config.OPENAI_BASE_URL}")
    logger.info(f"默认模型: {Config.OPENAI_MODEL}")
    
    # 启动 FastAPI 服务器
    uvicorn.run(
        app,
        host=Config.WS_HOST,
        port=Config.WS_PORT,
        log_level=Config.LOG_LEVEL.lower(),
        access_log=True,
    )


if __name__ == "__main__":
    main()

