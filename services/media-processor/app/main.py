"""FastAPI 主入口模块。

Distill 媒体处理服务，提供：
- 抖音视频下载与 ASR 转写
- 小红书笔记提取（图文/视频）
- PDF 文档解析（opendataloader-pdf）
- 独立 ASR 语音识别

启动方式：
    py -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import asr, douyin, pdf, xiaohongshu
from .config import ensure_dirs, settings
from .schemas.media import ErrorResponse, HealthResponse
from .utils.cleanup import cleanup_expired_files

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。

    启动时：创建必要目录、检查依赖
    关闭时：清理临时文件
    """
    logger.info("启动 %s 服务...", settings.APP_NAME)

    # 创建必要目录
    ensure_dirs()
    logger.info("临时目录: %s", settings.TEMP_DIR)
    logger.info("上传目录: %s", settings.UPLOAD_DIR)

    # 检查关键依赖
    _check_dependencies()

    # 清理过期的临时文件
    cleaned = cleanup_expired_files()
    if cleaned > 0:
        logger.info("启动时清理了 %d 个过期临时文件", cleaned)

    logger.info("%s 服务启动完成，监听 %s:%d", settings.APP_NAME, settings.HOST, settings.PORT)

    yield

    # 关闭时清理
    logger.info("%s 服务关闭中...", settings.APP_NAME)


def _check_dependencies() -> None:
    """检查关键依赖是否可用。

    检查 ffmpeg、Java（opendataloader-pdf 需要）等系统依赖，
    缺失时仅记录警告，不阻止启动（部分功能不可用）。
    """
    import shutil

    # 检查 ffmpeg
    if shutil.which("ffmpeg"):
        logger.info("ffmpeg 已安装")
        # 检查 ffmpeg 版本和 libmp3lame 编码器支持
        try:
            import subprocess

            # ffmpeg 版本
            version_result = subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if version_result.returncode == 0:
                first_line = version_result.stdout.split("\n")[0]
                logger.info("ffmpeg 版本: %s", first_line)

            # 检查 libmp3lame 编码器（音频提取必需）
            encoders_result = subprocess.run(
                ["ffmpeg", "-hide_banner", "-encoders"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if encoders_result.returncode == 0:
                has_mp3lame = "libmp3lame" in encoders_result.stdout
                if has_mp3lame:
                    logger.info("ffmpeg 支持 libmp3lame 编码器（MP3 输出可用）")
                else:
                    logger.error(
                        "ffmpeg 不支持 libmp3lame 编码器！音频提取将失败。"
                        "请在 Dockerfile 中安装带 libmp3lame 的 ffmpeg。"
                    )
            else:
                logger.warning("无法获取 ffmpeg 编码器列表")
        except Exception as e:
            logger.warning("检查 ffmpeg 编码器支持时出错: %s", e)
    else:
        logger.warning("ffmpeg 未安装，音频分离功能不可用")

    # 检查 Java（opendataloader-pdf 依赖）
    if shutil.which("java"):
        logger.info("Java 已安装")
    else:
        logger.warning("Java 未安装，opendataloader-pdf 可能无法正常工作")

    # 检查 opendataloader-pdf
    try:
        import opendataloader_pdf  # noqa: F401

        logger.info("opendataloader-pdf 已安装")
    except ImportError:
        logger.warning("opendataloader-pdf 未安装，PDF 解析功能不可用")

    # 检查 whisper（延迟加载，此处仅提示）
    try:
        import whisper  # noqa: F401

        logger.info("openai-whisper 已安装")
    except ImportError:
        logger.warning("openai-whisper 未安装，本地 ASR 不可用")


# 创建 FastAPI 应用
app = FastAPI(
    title="Distill 媒体处理服务",
    description="""
    AI 知识蒸馏站的媒体处理微服务。

    ## 功能

    * **抖音视频处理**：下载视频 → 分离音频 → ASR 转写
    * **小红书笔记处理**：提取图文/视频笔记内容
    * **PDF 解析**：使用 opendataloader-pdf 提取 Markdown
    * **ASR 语音识别**：独立音频转写接口

    ## 技术栈

    * FastAPI - Web 框架
    * yt-dlp - 视频下载
    * ffmpeg-python - 音频分离
    * opendataloader-pdf - PDF 解析
    * openai-whisper - 本地 ASR
    """,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 中间件（允许浏览器直传大文件 + Next.js 服务跨域调用）
# 注意：allow_origins=["*"] + allow_credentials=True 在浏览器中冲突，
# 会致 CORS 预检失败（FormData POST 会触发预检）。
# 改为显式列出允许的来源，或不使用 credentials。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # 不需要 Cookie，关闭即可与通配符 origin 共存
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# 全局异常处理
# ============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器。

    捕获未处理的异常，返回统一格式的错误响应。
    """
    logger.exception("未处理的异常: %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="internal_server_error",
            message="服务内部错误",
            detail=str(exc) if settings.DEBUG else None,
        ).model_dump(),
    )


# ============================================================================
# 健康检查
# ============================================================================


@app.get("/health", response_model=HealthResponse, tags=["系统"])
async def health_check() -> HealthResponse:
    """健康检查接口。

    返回服务状态和各子服务的可用性。
    """
    import shutil

    services: dict[str, str] = {}

    # 检查 ffmpeg
    services["ffmpeg"] = "ok" if shutil.which("ffmpeg") else "missing"

    # 检查 Java
    services["java"] = "ok" if shutil.which("java") else "missing"

    # 检查 opendataloader-pdf
    try:
        import opendataloader_pdf  # noqa: F401

        services["opendataloader_pdf"] = "ok"
    except ImportError:
        services["opendataloader_pdf"] = "missing"

    # 检查 whisper
    try:
        import whisper  # noqa: F401

        services["whisper"] = "ok"
    except ImportError:
        services["whisper"] = "missing"

    # 整体状态：核心功能（ffmpeg）可用即为 ok
    overall_status = "ok" if services["ffmpeg"] == "ok" else "degraded"

    return HealthResponse(
        status=overall_status,
        version="0.1.0",
        services=services,
    )


@app.get("/", tags=["系统"])
async def root():
    """根路径，返回服务信息。"""
    return {
        "name": "Distill 媒体处理服务",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


# ============================================================================
# 注册路由
# ============================================================================

app.include_router(douyin.router)
app.include_router(xiaohongshu.router)
app.include_router(asr.router)
app.include_router(pdf.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
