"""配置管理模块。

使用 pydantic-settings 从环境变量加载配置，
支持 .env 文件和系统环境变量两种方式。
"""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """服务全局配置。

    所有配置项均可通过环境变量覆盖，环境变量名不区分大小写。
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 服务配置
    APP_NAME: str = "distill-media-processor"
    """服务名称，用于日志和监控。"""

    HOST: str = "0.0.0.0"
    """监听地址。"""

    PORT: int = 8001
    """监听端口。"""

    DEBUG: bool = False
    """是否开启调试模式。"""

    # 临时文件目录
    TEMP_DIR: str = str(Path.cwd() / "tmp")
    """临时文件存放目录（视频、音频、PDF 中间产物）。"""

    UPLOAD_DIR: str = str(Path.cwd() / "uploads")
    """上传文件存放目录。"""

    # 文件保留时长（秒），超时后清理
    TEMP_FILE_TTL: int = 3600
    """临时文件保留时长，默认 1 小时。"""

    # ASR 配置
    ASR_PROVIDER: Literal["whisper-local", "cloud"] = "whisper-local"
    """ASR 供应商：whisper-local（本地兜底）或 cloud（云端 API）。"""

    WHISPER_MODEL_SIZE: Literal["tiny", "base", "small", "medium", "large"] = "base"
    """本地 Whisper 模型大小，base 适合中文且速度较快。"""

    # 云端 ASR 配置（当 ASR_PROVIDER=cloud 时生效）
    CLOUD_ASR_PROVIDER: Literal["tongyi", "xunfei", "openai"] = "openai"
    """云端 ASR 供应商。"""

    CLOUD_ASR_API_KEY: str = ""
    """云端 ASR API Key。"""

    CLOUD_ASR_API_URL: str = ""
    """云端 ASR API 地址（可选，部分供应商需要）。"""

    # PDF 解析配置
    PDF_HYBRID_MODE: bool = False
    """是否默认启用 opendataloader-pdf Hybrid 模式。

    Hybrid 模式支持扫描件 OCR、复杂表格、公式识别，
    但需要额外安装 opendataloader-pdf[hybrid] 并启动后端服务。
    """

    PDF_HYBRID_BACKEND: str = "docling-fast"
    """Hybrid 后端引擎，默认 docling-fast。"""

    # 下载配置
    MAX_VIDEO_DURATION: int = 1800
    """最大允许下载的视频时长（秒），默认 30 分钟。"""

    DOWNLOAD_TIMEOUT: int = 120
    """下载超时时间（秒）。"""

    # 日志配置
    LOG_LEVEL: str = "INFO"
    """日志级别。"""

    # 内部调用密钥（可选，用于 Next.js 主服务调用时的鉴权）
    INTERNAL_API_KEY: str = ""
    """内部 API 密钥，为空则不校验。"""

    # 抖音/小红书 Cookie（可选，用于反爬）
    DOUYIN_COOKIE: str = ""
    """抖音 Cookie，用于绕过部分反爬限制。"""

    XIAOHONGSHU_COOKIE: str = ""
    """小红书 Cookie，用于绕过部分反爬限制。"""

    # User-Agent
    USER_AGENT: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    """HTTP 请求默认 User-Agent。"""


def get_settings() -> Settings:
    """获取全局配置单例。

    Returns:
        Settings 实例
    """
    return Settings()


# 全局配置实例
settings = get_settings()


def ensure_dirs() -> None:
    """确保必要的目录存在。

    在服务启动时调用，创建临时目录和上传目录。
    """
    Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
