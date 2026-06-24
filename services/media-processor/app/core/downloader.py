"""视频下载器模块。

使用 yt-dlp 库下载抖音、小红书等多平台视频，
并提取视频元数据（标题、作者、时长等）。

抖音视频优先使用 iesdouyin.com 解析（无需 Cookie），yt-dlp 作为 fallback。
"""

import json
import logging
import re
from pathlib import Path
from typing import Any

import requests
from yt_dlp import YoutubeDL

from ..config import settings

logger = logging.getLogger(__name__)

# 移动端 User-Agent，用于抖音解析
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "EdgiOS/121.0.2277.107 Version/17.0 Mobile/15E148 Safari/604.1"
)


def _parse_douyin_share_url(share_text: str) -> dict[str, Any]:
    """解析抖音分享链接，获取无水印视频直链（无需 Cookie）。

    通过 iesdouyin.com 的分享页面解析视频信息，
    将 playwm 替换为 play 获取无水印视频地址。

    Args:
        share_text: 抖音分享文本或链接

    Returns:
        包含 url、title、video_id 的字典

    Raises:
        ValueError: 未找到有效链接或解析失败
    """
    headers = {"User-Agent": MOBILE_UA}

    # 从分享文本中提取 URL
    urls = re.findall(
        r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
        share_text,
    )
    if not urls:
        raise ValueError("未找到有效的分享链接")

    share_url = urls[0]
    logger.info("解析抖音分享链接: %s", share_url)

    # 请求分享链接，获取重定向后的 video_id
    share_response = requests.get(share_url, headers=headers, allow_redirects=True, timeout=30)
    video_id = share_response.url.split("?")[0].strip("/").split("/")[-1]

    if not video_id.isdigit():
        raise ValueError(f"无法从链接中提取视频 ID: {share_response.url}")

    # 构造 iesdouyin 分享页面 URL
    share_url = f"https://www.iesdouyin.com/share/video/{video_id}"
    logger.info("请求 iesdouyin 分享页面: %s", share_url)

    response = requests.get(share_url, headers=headers, timeout=30)
    response.raise_for_status()

    # 从 HTML 中提取 window._ROUTER_DATA JSON 数据
    pattern = re.compile(
        pattern=r"window\._ROUTER_DATA\s*=\s*(.*?)</script>",
        flags=re.DOTALL,
    )
    find_res = pattern.search(response.text)
    if not find_res or not find_res.group(1):
        raise ValueError("从 HTML 中解析视频信息失败")

    json_data = json.loads(find_res.group(1).strip())

    VIDEO_ID_PAGE_KEY = "video_(id)/page"
    NOTE_ID_PAGE_KEY = "note_(id)/page"

    if VIDEO_ID_PAGE_KEY in json_data["loaderData"]:
        original_video_info = json_data["loaderData"][VIDEO_ID_PAGE_KEY]["videoInfoRes"]
    elif NOTE_ID_PAGE_KEY in json_data["loaderData"]:
        original_video_info = json_data["loaderData"][NOTE_ID_PAGE_KEY]["videoInfoRes"]
    else:
        raise ValueError("无法从 JSON 中解析视频或图集信息")

    data = original_video_info["item_list"][0]

    # 获取无水印视频 URL（将 playwm 替换为 play）
    video_url = data["video"]["play_addr"]["url_list"][0].replace("playwm", "play")
    desc = data.get("desc", "").strip() or f"douyin_{video_id}"

    # 替换文件名中的非法字符
    desc = re.sub(r'[\\/:*?"<>|]', "_", desc)

    author = ""
    if "author" in data:
        author = data["author"].get("nickname", "")

    duration = int(data.get("duration", 0)) // 1000  # 毫秒转秒

    logger.info("抖音视频解析成功: %s (作者: %s, 时长: %ds)", desc, author, duration)

    return {
        "url": video_url,
        "title": desc,
        "video_id": video_id,
        "author": author,
        "duration": duration,
    }


def _download_video_direct(
    video_url: str,
    output_dir: Path,
    video_id: str,
) -> str:
    """直接下载视频文件（无需 yt-dlp）。

    Args:
        video_url: 视频直链
        output_dir: 输出目录
        video_id: 视频 ID（用于文件名）

    Returns:
        下载的文件路径
    """
    headers = {"User-Agent": MOBILE_UA}
    file_path = str(output_dir / f"{video_id}.mp4")

    logger.info("开始下载视频: %s", video_url)
    response = requests.get(video_url, headers=headers, stream=True, timeout=120)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))
    downloaded = 0

    with open(file_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)

    logger.info("视频下载完成: %s (%.2f MB)", file_path, downloaded / 1024 / 1024)
    return file_path


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

    优先使用 iesdouyin.com 解析（无需 Cookie），失败时 fallback 到 yt-dlp。

    Args:
        url: 抖音视频分享链接
        output_dir: 输出目录
        cookie: 可选 Cookie（仅在 fallback 到 yt-dlp 时使用）

    Returns:
        包含 file_path、title、author、duration 的字典

    Raises:
        DownloadError: 下载失败
    """
    # 优先尝试无 Cookie 解析方式
    try:
        logger.info("尝试无 Cookie 解析抖音视频: %s", url)
        video_info = _parse_douyin_share_url(url)
        file_path = _download_video_direct(video_info["url"], output_dir, video_info["video_id"])

        return {
            "file_path": file_path,
            "title": video_info["title"],
            "author": video_info["author"],
            "duration": video_info["duration"],
            "video_id": video_info["video_id"],
            "platform": "douyin",
        }
    except Exception as e:
        logger.warning("无 Cookie 解析失败: %s，回退到 yt-dlp", str(e))

    # Fallback: 使用 yt-dlp（需要 Cookie）
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
