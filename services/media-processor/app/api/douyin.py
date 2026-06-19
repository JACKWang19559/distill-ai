"""抖音视频处理 API 路由。

完整流程：下载视频 → 分离音频 → ASR 识别 → 返回转写文本
"""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..core.asr_provider import get_asr_provider
from ..core.audio_extractor import extract_audio, get_audio_duration
from ..core.downloader import download_douyin_video
from ..schemas.media import DouyinRequest, DouyinResponse
from ..utils.cleanup import cleanup_temp_files, get_task_temp_dir

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["抖音视频处理"])


@router.post("/douyin", response_model=DouyinResponse)
async def process_douyin_video(request: DouyinRequest) -> DouyinResponse:
    """处理抖音视频。

    完整流程：
    1. 使用 yt-dlp 下载抖音视频
    2. 使用 ffmpeg 从视频中分离音频（WAV 16kHz 单声道）
    3. 使用 ASR 引擎将音频转写为文本
    4. 清理临时文件并返回结果

    Args:
        request: 包含 url、cookie、task_id 的请求体

    Returns:
        DouyinResponse: 包含转写文本和视频元数据的响应

    Raises:
        HTTPException 400: URL 为空或格式错误
        HTTPException 500: 下载/分离/识别失败
    """
    # 参数校验
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="抖音视频 URL 不能为空")

    # 创建任务专属临时目录
    task_dir = get_task_temp_dir(request.task_id, prefix="douyin")

    try:
        # 步骤 1：下载视频
        logger.info("[%s] 开始下载抖音视频: %s", request.task_id, request.url)
        video_info = download_douyin_video(
            url=request.url,
            output_dir=task_dir,
            cookie=request.cookie,
        )

        # 检查视频时长是否超限
        if video_info["duration"] > settings.MAX_VIDEO_DURATION:
            raise HTTPException(
                status_code=400,
                detail=f"视频时长 {video_info['duration']}s 超过最大限制 {settings.MAX_VIDEO_DURATION}s",
            )

        # 步骤 2：分离音频
        logger.info("[%s] 开始分离音频", request.task_id)
        audio_path = task_dir / "audio.wav"
        extract_audio(Path(video_info["file_path"]), audio_path)

        # 如果仅提取音频，不进行 ASR
        if request.extract_audio_only:
            return DouyinResponse(
                transcript="",
                title=video_info["title"],
                author=video_info["author"],
                duration=video_info["duration"],
                audio_url=str(audio_path),
            )

        # 步骤 3：ASR 识别
        logger.info("[%s] 开始 ASR 识别", request.task_id)
        asr_provider = get_asr_provider()
        transcript = asr_provider.transcribe(audio_path)

        logger.info("[%s] 抖音视频处理完成", request.task_id)

        return DouyinResponse(
            transcript=transcript,
            title=video_info["title"],
            author=video_info["author"],
            duration=video_info["duration"],
            audio_url=None,
        )

    except HTTPException:
        raise
    except FileNotFoundError as e:
        logger.error("[%s] 文件未找到: %s", request.task_id, e)
        raise HTTPException(status_code=500, detail=f"文件处理失败: {e}")
    except ValueError as e:
        logger.error("[%s] 参数错误: %s", request.task_id, e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("[%s] 抖音视频处理失败", request.task_id)
        raise HTTPException(status_code=500, detail=f"处理失败: {e}")
    finally:
        # 清理临时文件（视频文件较大，处理完即删）
        # 注意：如果 extract_audio_only=True，音频文件会被保留
        # 实际生产中应通过定时任务清理
        if not request.extract_audio_only:
            cleanup_temp_files(task_dir)
