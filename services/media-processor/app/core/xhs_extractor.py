"""小红书笔记内容提取模块。

提取小红书笔记的标题、正文、图片或视频链接。
支持图文笔记和视频笔记两种类型。

注意：小红书有较强的反爬机制，部分内容可能需要 Cookie。
此模块提供基础提取能力，复杂场景建议结合浏览器自动化方案。
"""

import json
import logging
import re
from typing import Any

import requests
from bs4 import BeautifulSoup

from ..config import settings

logger = logging.getLogger(__name__)

# 小红书笔记 URL 正则
# 支持 https://www.xiaohongshu.com/explore/{note_id} 和 https://www.xiaohongshu.com/discovery/item/{note_id}
XHS_NOTE_URL_PATTERN = re.compile(
    r"xiaohongshu\.com/(?:explore|discovery/item|note)/([a-f0-9]+)",
    re.IGNORECASE,
)


def _build_headers(cookie: str | None = None) -> dict[str, str]:
    """构建请求头。

    Args:
        cookie: 可选 Cookie 字符串

    Returns:
        包含 User-Agent 和 Cookie 的请求头字典
    """
    headers = {
        "User-Agent": settings.USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }
    if cookie:
        headers["Cookie"] = cookie
    return headers


def _extract_from_jsonld(soup: BeautifulSoup) -> dict[str, Any] | None:
    """从 JSON-LD 结构化数据中提取笔记信息。

    小红书页面可能包含 JSON-LD 结构化数据，这是最可靠的提取方式。

    Args:
        soup: BeautifulSoup 对象

    Returns:
        包含笔记信息的字典，无 JSON-LD 时返回 None
    """
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict):
                return {
                    "title": data.get("name", "") or data.get("title", ""),
                    "content": data.get("description", "") or data.get("articleBody", ""),
                    "author": data.get("author", {}).get("name", "")
                    if isinstance(data.get("author"), dict)
                    else "",
                    "image_url": data.get("image", "") or data.get("thumbnailUrl", ""),
                }
        except (json.JSONDecodeError, TypeError):
            continue
    return None


def _extract_from_initial_state(soup: BeautifulSoup) -> dict[str, Any] | None:
    """从页面初始状态 JSON 中提取笔记信息。

    小红书 SPA 页面会在 window.__INITIAL_STATE__ 中预渲染数据。
    注意：原始数据中可能包含 undefined 值（非合法 JSON），需先替换为 null。

    数据结构：
        note.noteDetailMap[noteId].note = {
            "title": "标题",
            "desc": "正文描述",
            "type": "video" | "normal",
            "user": {"nickname": "作者"},
            "video": {"media": {"stream": {"h264": [{"masterUrl": "..."}]}}},
            "imageList": [{"urlDefault": "..."}],
            "tagList": [{"name": "标签"}],
            "ipLocation": "江苏",
            "time": 1780704042000,
            "interactInfo": {"likedCount": "5305", ...}
        }

    Args:
        soup: BeautifulSoup 对象

    Returns:
        包含笔记信息的字典，无数据时返回 None
    """
    for script in soup.find_all("script"):
        text = script.string or ""
        if "__INITIAL_STATE__" not in text:
            continue

        # 提取 JSON 字符串
        # 使用贪婪匹配 .* 确保捕获完整的 JSON 对象（直到行尾的 } ）
        match = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*\})", text, re.DOTALL)
        if not match:
            match = re.search(r"__INITIAL_STATE__\s*=\s*(\{.*\})", text, re.DOTALL)
        if not match:
            continue

        json_str = match.group(1)

        # 小红书的 __INITIAL_STATE__ 包含 undefined 值（非合法 JSON）
        # 需要替换为 null 才能被 json.loads 解析
        json_str = re.sub(r"\bundefined\b", "null", json_str)

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.debug("解析 __INITIAL_STATE__ JSON 失败: %s", e)
            continue

        # 小红书数据结构：note.noteDetailMap[noteId].note
        note_detail_map = data.get("note", {}).get("noteDetailMap", {})
        if not note_detail_map or not isinstance(note_detail_map, dict):
            continue

        # 取第一个笔记（通常只有一个）
        note_data = list(note_detail_map.values())[0].get("note", {})
        if not note_data:
            continue

        # 提取标签列表
        tag_list = note_data.get("tagList", [])
        tags = [tag.get("name", "") for tag in tag_list if isinstance(tag, dict)]

        # 提取互动信息
        interact_info = note_data.get("interactInfo", {}) or {}

        result = {
            "title": note_data.get("title", ""),
            "content": note_data.get("desc", ""),
            "author": note_data.get("user", {}).get("nickname", ""),
            "note_type": note_data.get("type", ""),  # normal(图文) / video
            "video_url": _extract_video_url(note_data),
            "image_urls": _extract_image_urls(note_data),
            "tags": tags,
            "ip_location": note_data.get("ipLocation", ""),
            "publish_time": note_data.get("time", 0),
            "note_id": note_data.get("noteId", ""),
            "liked_count": interact_info.get("likedCount", ""),
            "collected_count": interact_info.get("collectedCount", ""),
            "comment_count": interact_info.get("commentCount", ""),
            "share_count": interact_info.get("shareCount", ""),
        }

        logger.info(
            "从 __INITIAL_STATE__ 提取成功: type=%s, title=%s, author=%s",
            result["note_type"],
            result["title"][:30],
            result["author"],
        )
        return result

    return None


def _extract_from_meta(soup: BeautifulSoup) -> dict[str, Any] | None:
    """从 HTML meta 标签提取笔记信息（备选方案）。

    小红书页面包含丰富的 Open Graph meta 标签：
    - og:title: 笔记标题
    - og:type: "video" 或 "image"
    - og:video: 视频地址
    - og:image: 封面图
    - og:videotime: 视频时长
    - og:xhs:note_like: 点赞数
    - description: 描述/标签

    Args:
        soup: BeautifulSoup 对象

    Returns:
        包含笔记信息的字典，无 meta 数据时返回 None
    """
    meta_data: dict[str, str] = {}
    for meta in soup.find_all("meta"):
        key = meta.get("property", meta.get("name", ""))
        value = meta.get("content", "")
        if key and value:
            meta_data[key] = value

    # 至少需要有 og:title 才认为有效
    if "og:title" not in meta_data:
        return None

    # 从 og:title 中去除 " - 小红书" 后缀
    title = meta_data.get("og:title", "")
    if title.endswith(" - 小红书"):
        title = title[: -len(" - 小红书")]

    # 判断笔记类型
    og_type = meta_data.get("og:type", "")
    note_type = "video" if og_type == "video" else "image"

    # 视频地址
    video_url = meta_data.get("og:video", "") or None

    # 描述
    content = meta_data.get("description", "")

    logger.info(
        "从 meta 标签提取: type=%s, title=%s",
        note_type,
        title[:30],
    )

    return {
        "title": title,
        "content": content,
        "author": "",  # meta 标签中通常没有作者信息
        "note_type": note_type,
        "video_url": video_url,
        "image_urls": [meta_data.get("og:image", "")] if meta_data.get("og:image") else [],
        "tags": [],
        "ip_location": "",
        "publish_time": 0,
        "note_id": "",
        "liked_count": meta_data.get("og:xhs:note_like", ""),
        "collected_count": meta_data.get("og:xhs:note_collect", ""),
        "comment_count": meta_data.get("og:xhs:note_comment", ""),
        "share_count": "",
    }


def _extract_video_url(note_data: dict) -> str | None:
    """从笔记数据中提取视频 URL。

    Args:
        note_data: 笔记数据字典

    Returns:
        视频 URL 字符串，无视频时返回 None
    """
    video = note_data.get("video", {})
    if not video:
        return None

    # 视频地址可能在 media.stream.h264[].masterUrl 或 media.consumer.originVideoKey
    media = video.get("media", {})
    stream = media.get("stream", {})

    # 优先 h264，其次 h265
    for codec in ["h264", "h265", "av1"]:
        streams = stream.get(codec, [])
        if streams and isinstance(streams, list):
            return streams[0].get("masterUrl", "")

    # 备选：consumer.originVideoKey
    consumer = media.get("consumer", {})
    if consumer.get("originVideoKey"):
        return consumer["originVideoKey"]

    return None


def _extract_image_urls(note_data: dict) -> list[str]:
    """从笔记数据中提取图片 URL 列表。

    Args:
        note_data: 笔记数据字典

    Returns:
        图片 URL 列表
    """
    image_list = note_data.get("imageList", [])
    urls = []
    for img in image_list:
        url = img.get("urlDefault", "") or img.get("url", "")
        if url:
            urls.append(url)
    return urls


def extract_xiaohongshu_note(
    url: str,
    cookie: str | None = None,
) -> dict[str, Any]:
    """提取小红书笔记内容。

    提取流程：
    1. 优先从 __INITIAL_STATE__ 提取（最准确，含完整笔记数据）
    2. 降级从 meta 标签提取（Open Graph，含视频地址）
    3. 降级从 JSON-LD 提取
    4. 最后降级从 HTML 标签提取

    Args:
        url: 小红书笔记链接
        cookie: 可选 Cookie（用于反爬）

    Returns:
        包含以下字段的字典：
        - note_type: 笔记类型（image/video）
        - title: 笔记标题
        - content: 笔记正文
        - author: 作者昵称
        - video_url: 视频笔记的视频地址（图文笔记为 None）
        - image_urls: 图片 URL 列表
        - tags: 标签列表
        - ip_location: IP 归属地
        - liked_count: 点赞数
        - collected_count: 收藏数
        - comment_count: 评论数

    Raises:
        ValueError: URL 格式错误
        requests.RequestException: 网络请求失败
        Exception: 提取失败
    """
    if not url or "xiaohongshu.com" not in url:
        raise ValueError(f"无效的小红书链接: {url}")

    # 优先使用配置中的 Cookie
    effective_cookie = cookie or settings.XIAOHONGSHU_COOKIE or None
    headers = _build_headers(effective_cookie)

    logger.info("开始提取小红书笔记: %s", url)

    # 请求页面
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # 策略 1：从 __INITIAL_STATE__ 提取（最准确，含完整数据）
    result = _extract_from_initial_state(soup)

    # 策略 2：从 meta 标签提取（Open Graph，含视频地址）
    if not result:
        result = _extract_from_meta(soup)

    # 策略 3：从 JSON-LD 提取
    if not result:
        result = _extract_from_jsonld(soup)

    # 策略 4：从 HTML 标签降级提取
    if not result:
        result = _extract_from_html(soup)

    if not result:
        raise RuntimeError("无法从页面提取笔记内容，可能需要 Cookie 或页面结构已变更")

    # 标准化输出
    note_type = result.get("note_type", "")
    video_url = result.get("video_url")
    if note_type == "video" or video_url:
        note_type = "video"
    else:
        note_type = "image"

    output = {
        "note_type": note_type,
        "title": result.get("title", ""),
        "content": result.get("content", ""),
        "author": result.get("author", ""),
        "video_url": video_url,
        "image_urls": result.get("image_urls", []),
        "tags": result.get("tags", []),
        "ip_location": result.get("ip_location", ""),
        "publish_time": result.get("publish_time", 0),
        "note_id": result.get("note_id", ""),
        "liked_count": result.get("liked_count", ""),
        "collected_count": result.get("collected_count", ""),
        "comment_count": result.get("comment_count", ""),
        "share_count": result.get("share_count", ""),
    }

    logger.info(
        "小红书笔记提取完成: 类型=%s, 标题=%s, 作者=%s, 标签=%s",
        output["note_type"],
        output["title"][:30],
        output["author"],
        output["tags"],
    )

    return output


def _extract_from_html(soup: BeautifulSoup) -> dict[str, Any]:
    """从 HTML 标签降级提取笔记信息。

    当 __INITIAL_STATE__ 和 JSON-LD 都不可用时使用。
    准确率较低，仅作为兜底方案。

    Args:
        soup: BeautifulSoup 对象

    Returns:
        包含笔记信息的字典
    """
    # 提取标题
    title = ""
    title_tag = soup.find("title")
    if title_tag:
        # 小红书页面标题格式通常为 "标题 - 小红书"
        title = title_tag.text.split(" - ")[0].strip()

    # 提取正文（尝试多个可能的 class）
    content = ""
    for class_pattern in ["content", "desc", "note-content", "note-text"]:
        content_el = soup.find(class_=re.compile(class_pattern, re.IGNORECASE))
        if content_el:
            content = content_el.get_text(strip=True)
            if content:
                break

    # 提取 meta description 作为备选
    if not content:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            content = meta_desc.get("content", "")

    # 检测视频
    video_el = soup.find("video")
    video_url = video_el.get("src", "") if video_el else None

    # 提取图片
    image_urls = []
    for img in soup.find_all("img", class_=re.compile("note|content", re.IGNORECASE)):
        src = img.get("src", "")
        if src and "xiaohongshu" in src:
            image_urls.append(src)

    return {
        "title": title,
        "content": content,
        "author": "",
        "note_type": "video" if video_url else "image",
        "video_url": video_url,
        "image_urls": image_urls,
    }
