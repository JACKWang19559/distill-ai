"""视频下载器模块。

使用 yt-dlp 库下载抖音、小红书等多平台视频，
并提取视频元数据（标题、作者、时长等）。
"""

import logging
from pathlib import Path
from typing import Any

from yt_dlp import YoutubeDL

from ..config import settings

logger = logging.getLogger(__name__)


def _build_ydl_opts(output_dir: Path, cookie: str | None = None) -> dict[str, Any]:
    """构建 yt-dlp 配置项。

    Args:
        output_dir: 输出目录
        cookie: 可选 Cookie 字符串

    Returns:
        yt-dlp 配置字典
    """
    opts: dict[str, Any] = {
        # 输出文件名模板：使用视频 ID + 扩展名
        "outtmpl": str(output_dir / "%(id)s.%(ext)s"),
        # 选择最佳质量（mp4 优先）
        "format": "best[ext=mp4]/best",
        # 不下载播放列表
        "noplaylist": True,
        # 静默模式，减少日志输出
        "quiet": True,
        # 不显示警告
        "no_warnings": True,
        # 下载超时
        "socket_timeout": settings.DOWNLOAD_TIMEOUT,
        # 重试次数
        "retries": 3,
        # User-Agent
        "http_headers": {
            "User-Agent": settings.USER_AGENT,
        },
    }

    # Cookie 处理：yt-dlp 支持两种方式
    # 1. cookiefile：指定 Cookie 文件路径
    # 2. http_headers.Cookie：直接传入 Cookie 字符串
    # 这里采用方式 2，更灵活
    if cookie:
        opts["http_headers"]["Cookie"] = cookie
        logger.debug("已设置自定义 Cookie")

    return opts


def download_video(
    url: str,
    output_dir: Path,
    cookie: str | None = None,
    platform: str = "douyin",
) -> dict[str, Any]:
    """下载视频并返回文件路径与元数据。

    支持抖音、小红书等平台，由 yt-dlp 自动识别。

    Args:
        url: 视频分享链接
        output_dir: 输出目录
        cookie: 可选 Cookie 字符串（用于反爬）
        platform: 平台标识（仅用于日志）

    Returns:
        包含 file_path、title、author、duration、video_id 的字典

    Raises:
        ValueError: URL 为空或格式错误
        DownloadError: 下载失败（网络错误、视频不存在等）
    """
    if not url or not url.strip():
        raise ValueError("视频 URL 不能为空")

    logger.info("开始下载 %s 视频: %s", platform, url)

    ydl_opts = _build_ydl_opts(output_dir, cookie)

    with YoutubeDL(ydl_opts) as ydl:
        # 提取视频信息并下载
        info = ydl.extract_info(url, download=True)

        # 获取实际下载的文件路径
        file_path = ydl.prepare_filename(info)

        # 检查文件是否存在
        if not Path(file_path).exists():
            # 尝试查找目录下最新创建的视频文件
            video_files = list(output_dir.glob("*.mp4")) + list(output_dir.glob("*.webm"))
            if not video_files:
                raise FileNotFoundError(f"视频下载完成但未找到文件: {file_path}")
            file_path = str(video_files[0])

        result = {
            "file_path": file_path,
            "title": info.get("title", ""),
            "author": info.get("uploader", "") or info.get("channel", ""),
            "duration": int(info.get("duration", 0) or 0),
            "video_id": info.get("id", ""),
            "platform": platform,
            "upload_date": info.get("upload_date", ""),
            "view_count": info.get("view_count", 0),
            "like_count": info.get("like_count", 0),
        }

        logger.info(
            "视频下载完成: %s (时长: %ds, 作者: %s)",
            result["title"],
            result["duration"],
            result["author"],
        )

        return result


def download_douyin_video(
    url: str,
    output_dir: Path,
    cookie: str | None = None,
) -> dict[str, Any]:
    """下载抖音视频。

    yt-dlp 对抖音的适配入口，支持 v.douyin.com 短链和完整链接。

    Args:
        url: 抖音视频分享链接
        output_dir: 输出目录
        cookie: 可选 Cookie

    Returns:
        包含 file_path、title、author、duration 的字典

    Raises:
        DownloadError: 下载失败
    """
    # 优先使用配置中的 Cookie
    effective_cookie = cookie or settings.DOUYIN_COOKIE or None
    return download_video(url, output_dir, effective_cookie, platform="douyin")


def download_xiaohongshu_video(
    url: str,
    output_dir: Path,
    cookie: str | None = None,
) -> dict[str, Any]:
    """下载小红书视频。

    Args:
        url: 小红书视频链接
        output_dir: 输出目录
        cookie: 可选 Cookie

    Returns:
        包含 file_path、title、author、duration 的字典

    Raises:
        DownloadError: 下载失败
    """
    effective_cookie = cookie or settings.XIAOHONGSHU_COOKIE or None
    return download_video(url, output_dir, effective_cookie, platform="xiaohongshu")
