"""音频分离模块。

使用 ffmpeg 从视频文件中分离音频轨道，
输出 ASR 友好的 WAV 格式（16kHz 单声道 16-bit PCM）。
"""

import logging
from pathlib import Path

import ffmpeg

logger = logging.getLogger(__name__)


def extract_audio(
    video_path: Path,
    output_path: Path,
    sample_rate: int = 16000,
) -> Path:
    """从视频文件中分离音频。

    输出格式为 WAV（PCM 16-bit），单声道，16kHz 采样率，
    这是 Whisper 等主流 ASR 引擎推荐的音频格式。

    Args:
        video_path: 视频文件路径
        output_path: 输出音频文件路径（建议以 .wav 结尾）
        sample_rate: 采样率，默认 16000Hz

    Returns:
        输出音频文件路径

    Raises:
        FileNotFoundError: 视频文件不存在
        ffmpeg.Error: ffmpeg 处理失败
    """
    video_path = Path(video_path)
    output_path = Path(output_path)

    if not video_path.exists():
        raise FileNotFoundError(f"视频文件不存在: {video_path}")

    logger.info("开始分离音频: %s -> %s", video_path, output_path)

    # 使用 ffmpeg 提取音频
    # 参数说明：
    # - ac=1: 单声道（ASR 不需要立体声）
    # - ar=16000: 16kHz 采样率（Whisper 标准）
    # - acodec=pcm_s16le: 16-bit PCM 编码（无损，ASR 友好）
    (
        ffmpeg.input(str(video_path))
        .output(
            str(output_path),
            ac=1,                    # 单声道
            ar=sample_rate,          # 采样率
            acodec="pcm_s16le",      # 16-bit PCM 编码
            vn=None,                 # 不包含视频流
        )
        .overwrite_output()
        .run(quiet=True)
    )

    if not output_path.exists():
        raise RuntimeError(f"音频分离完成但未找到输出文件: {output_path}")

    # 计算音频时长
    try:
        probe = ffmpeg.probe(str(output_path))
        duration = float(probe["format"]["duration"])
        logger.info("音频分离完成: 时长 %.1f 秒, 大小 %d KB", duration, output_path.stat().st_size // 1024)
    except (ffmpeg.Error, KeyError) as e:
        logger.warning("获取音频元数据失败: %s", e)

    return output_path


def get_audio_duration(audio_path: Path) -> float:
    """获取音频文件时长（秒）。

    Args:
        audio_path: 音频文件路径

    Returns:
        音频时长（秒）

    Raises:
        ffmpeg.Error: 无法读取音频信息
    """
    probe = ffmpeg.probe(str(audio_path))
    return float(probe["format"]["duration"])
