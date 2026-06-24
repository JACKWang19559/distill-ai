"""小红书笔记处理 API 路由。

支持图文笔记和视频笔记两种类型：
- 图文笔记：提取标题、正文、图片
- 视频笔记：提取标题、正文 + 下载视频 → 分离音频 → ASR
"""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from ..core.asr_provider import get_asr_provider
from ..core.audio_extractor import extract_audio
from ..core.downloader import download_xiaohongshu_video
from ..core.xhs_extractor import extract_xiaohongshu_note
from ..schemas.media import XiaohongshuRequest, XiaohongshuResponse
from ..utils.cleanup import cleanup_temp_files, get_task_temp_dir

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["小红书笔记处理"])


@router.post("/xiaohongshu", response_model=XiaohongshuResponse)
async def process_xiaohongshu_note(
    request: XiaohongshuRequest, req: Request
) -> XiaohongshuResponse:
    """处理小红书笔记。

    流程：
    1. 提取笔记内容（标题、正文、图片/视频链接）
    2. 如果是视频笔记，下载视频并 ASR 转写
    3. 返回完整内容

    ASR 凭证优先级：HTTP header（用户自带 Key）> 环境变量（服务端默认）

    Args:
        request: 包含 url、cookie、task_id 的请求体
        req: FastAPI Request 对象，用于读取 header 中的 ASR 凭证

    Returns:
        XiaohongshuResponse: 包含笔记内容和转写文本的响应

    Raises:
        HTTPException 400: URL 为空或格式错误
        HTTPException 500: 提取/下载/识别失败
    """
    if not request.url or "xiaohongshu.com" not in request.url:
        raise HTTPException(status_code=400, detail="无效的小红书链接")

    # 从 header 读取用户传入的 ASR 凭证（可选）
    header_asr_key = req.headers.get("x-asr-api-key")
    header_asr_url = req.headers.get("x-asr-api-url")
    header_asr_model = req.headers.get("x-asr-model")
    header_asr_provider = req.headers.get("x-asr-provider")

    task_dir = get_task_temp_dir(request.task_id, prefix="xiaohongshu")

    try:
        # 步骤 1：提取笔记内容
        logger.info("[%s] 开始提取小红书笔记: %s", request.task_id, request.url)
        note_data = extract_xiaohongshu_note(
            url=request.url,
            cookie=request.cookie,
        )

        transcript = ""

        # 步骤 2：如果是视频笔记，下载视频并 ASR
        if note_data["note_type"] == "video" and note_data.get("video_url"):
            logger.info("[%s] 检测到视频笔记，开始下载视频", request.task_id)
            try:
                video_info = download_xiaohongshu_video(
                    url=note_data["video_url"],
                    output_dir=task_dir,
                    cookie=request.cookie,
                )

                # 分离音频
                audio_path = task_dir / "audio.mp3"
                extract_audio(Path(video_info["file_path"]), audio_path)

                # ASR 识别（优先使用 header 凭证）
                asr_provider = get_asr_provider(
                    header_api_key=header_asr_key,
                    header_api_url=header_asr_url,
                    header_model=header_asr_model,
                    header_provider=header_asr_provider,
                )
                transcript = asr_provider.transcribe(audio_path)

                logger.info("[%s] 视频笔记 ASR 完成", request.task_id)

            except Exception as e:
                # 视频处理失败不影响文本内容返回
                logger.warning("[%s] 视频处理失败，仅返回文本内容: %s", request.task_id, e)
                transcript = ""

        logger.info("[%s] 小红书笔记处理完成", request.task_id)

        return XiaohongshuResponse(
            note_type=note_data["note_type"],
            title=note_data["title"],
            content=note_data["content"],
            transcript=transcript,
            author=note_data.get("author", ""),
            video_url=note_data.get("video_url"),
            tags=note_data.get("tags", []),
            ip_location=note_data.get("ip_location", ""),
            liked_count=note_data.get("liked_count", ""),
            collected_count=note_data.get("collected_count", ""),
            comment_count=note_data.get("comment_count", ""),
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.error("[%s] 参数错误: %s", request.task_id, e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("[%s] 小红书笔记处理失败", request.task_id)
        raise HTTPException(status_code=500, detail=f"处理失败: {e}")
    finally:
        cleanup_temp_files(task_dir)
