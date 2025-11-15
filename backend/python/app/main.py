"""
应用主入口 - 集成应用系统、数据库和文件处理
"""
import logging
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
from app.apps.app_registry import AppRegistry
from app.api.v1.endpoints import documents, workspaces

logger = logging.getLogger(__name__)

# 导入现有的 LLM WebSocket 服务（可选）
LLM_WS_AVAILABLE = False
try:
    # 尝试导入旧的 server 模块（如果存在）
    import sys
    import os
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from server import websocket_endpoint, health_check as llm_health_check
    LLM_WS_AVAILABLE = True
    logger.info("LLM WebSocket 服务模块已找到")
except ImportError as e:
    LLM_WS_AVAILABLE = False
    logger.info(f"LLM WebSocket 服务模块未找到，将仅启动应用系统: {e}")

# 配置日志 - 确保立即输出，不缓冲
import sys
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,  # 明确指定输出到 stdout
    force=True  # Python 3.8+ 支持，强制重新配置
)
# 禁用缓冲
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
sys.stderr.reconfigure(line_buffering=True) if hasattr(sys.stderr, 'reconfigure') else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("启动应用服务")
    logger.info(f"数据库连接: {settings.DATABASE_URL}")
    
    # 创建数据库表结构
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("数据库表结构初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        # 不阻止应用启动，但记录错误
    
    yield
    
    # 关闭时执行
    logger.info("关闭应用服务")


def create_application() -> FastAPI:
    """创建 FastAPI 应用"""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.PROJECT_DESCRIPTION,
        version=settings.VERSION,
        lifespan=lifespan
    )
    
    # 配置 CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 注册文档和工作区 API 路由
    app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
    app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["workspaces"])
    
    # 注册应用系统
    app_registry = AppRegistry()
    registered_count = app_registry.register_apps(app, api_prefix="/api")
    logger.info(f"应用注册完成: {registered_count} 个应用")
    
    # 集成现有的 LLM WebSocket 服务（如果可用）
    if LLM_WS_AVAILABLE:
        # 将 LLM WebSocket 路由添加到主应用
        @app.websocket("/ws")
        async def llm_websocket_endpoint(websocket):
            # 这里需要转发到原有的 LLM WebSocket 处理逻辑
            # 由于 FastAPI 的限制，我们需要手动处理
            try:
                await websocket_endpoint(websocket)
            except Exception as e:
                logger.error(f"LLM WebSocket 处理错误: {e}")
                await websocket.close()
        
        @app.get("/health")
        async def health_check():
            try:
                return await llm_health_check()
            except Exception as e:
                logger.error(f"LLM 健康检查失败: {e}")
                return JSONResponse({
                    "status": "ok",
                    "service": "app-backend",
                    "llm_backend": "unavailable"
                })
    else:
        # 提供基础健康检查
        @app.get("/health")
        async def health_check():
            return JSONResponse({
                "status": "ok",
                "service": "app-backend"
            })
    
    return app


# 创建应用实例
app = create_application()


def main():
    """主函数"""
    import uvicorn

    # 强制刷新输出，确保日志立即显示
    import sys
    sys.stdout.flush()
    sys.stderr.flush()

    logger.info("=" * 60)
    logger.info("🚀 启动 Python 后端服务")
    logger.info(f"📍 地址: {settings.HOST}:{settings.PORT}")
    logger.info(f"💾 数据库: {settings.DATABASE_URL}")
    logger.info(f"📁 上传目录: {settings.UPLOAD_DIR}")
    logger.info(f"🔑 OPENAI_API_KEY: {'✅ 已配置' if settings.OPENAI_API_KEY else '❌ 未配置'}")
    if settings.OPENAI_API_KEY:
        logger.info(f"   - 长度: {len(settings.OPENAI_API_KEY)}")
        logger.info(f"   - 前缀: {settings.OPENAI_API_KEY[:15]}...")
    logger.info(f"🌐 OPENAI_BASE_URL: {settings.OPENAI_BASE_URL}")
    logger.info(f"🤖 OPENAI_MODEL: {settings.OPENAI_MODEL}")
    logger.info("=" * 60)
    
    # 再次刷新
    sys.stdout.flush()
    sys.stderr.flush()

    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
        # 确保日志立即输出，不缓冲
        log_config=None,  # 使用默认配置，但通过 logging.basicConfig 已配置
    )


if __name__ == "__main__":
    main()

