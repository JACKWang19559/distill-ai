"""ASR 语音识别 API 路由。

提供独立的音频转写接口，支持本地 Whisper 和云端 ASR。
"""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..core.audio_extractor import get_audio_duration
from ..core.asr_provider import get_asr_provider
from ..schemas.media import ASRRequest, ASRResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["ASR 语音识别"])


@router.post("/asr", response_model=ASRResponse)
async def transcribe_audio(request: ASRRequest) -> ASRResponse:
    """音频转写接口。

    将音频文件转写为文本，支持指定供应商或使用默认配置。

    Args:
        request: 包含 audio_path 和可选 provider 的请求体

    Returns:
        ASRResponse: 包含转写文本和元数据的响应

    Raises:
        HTTPException 400: 音频文件路径为空
        HTTPException 404: 音频文件不存在
        HTTPException 500: 转写失败
    """
    if not request.audio_path or not request.audio_path.strip():
        raise HTTPException(status_code=400, detail="音频文件路径不能为空")

    audio_path = Path(request.audio_path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"音频文件不存在: {audio_path}")

    try:
        logger.info("开始 ASR 转写: %s (provider: %s)", audio_path, request.provider)

        # 获取音频时长
        try:
            duration = get_audio_duration(audio_path)
        except Exception as e:
            logger.warning("获取音频时长失败: %s", e)
            duration = 0

        # 获取 ASR 供应商并转写
        asr_provider = get_asr_provider(request.provider)
        transcript = asr_provider.transcribe(audio_path)

        provider_name = request.provider or "default"

        logger.info("ASR 转写完成: 文本长度 %d, 时长 %.1f 秒", len(transcript), duration)

        return ASRResponse(
            transcript=transcript,
            provider=provider_name,
            duration=duration,
        )

    except ValueError as e:
        logger.error("参数错误: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("ASR 转写失败")
        raise HTTPException(status_code=500, detail=f"转写失败: {e}")
