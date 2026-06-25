"""音频分离模块。

使用 ffmpeg 从视频文件中分离音频轨道，
输出 ASR 友好的 MP3 格式（16kHz 单声道），减小文件体积。
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

    输出格式为 MP3，单声道，16kHz 采样率，
    文件体积约为 WAV 的 1/10，适合上传到云端 ASR API。

    Args:
        video_path: 视频文件路径
        output_path: 输出音频文件路径（建议以 .mp3 结尾）
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

    # 先探测视频是否包含音频流（避免 ffmpeg 失败时只有通用错误）
    try:
        probe = ffmpeg.probe(str(video_path))
        streams = probe.get("streams", [])
        audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
        video_streams = [s for s in streams if s.get("codec_type") == "video"]
        logger.info(
            "视频探测: 视频流 %d 条, 音频流 %d 条 (格式: %s)",
            len(video_streams),
            len(audio_streams),
            probe.get("format", {}).get("format_name", "unknown"),
        )
        if not audio_streams:
            raise RuntimeError(
                f"视频文件不包含音频流: {video_path}（视频流 {len(video_streams)} 条, 音频流 0 条）"
            )
    except ffmpeg.Error as e:
        # probe 失败不阻断流程，继续尝试 ffmpeg 转换
        logger.warning("视频探测失败（将继续尝试转换）: %s", e)

    # 使用 ffmpeg 提取音频
    # 参数说明：
    # - ac=1: 单声道（ASR 不需要立体声）
    # - ar=16000: 16kHz 采样率（ASR 标准）
    # - acodec=libmp3lame: MP3 编码（压缩率高，文件小）
    # - audio_bit_rate=64k: 64kbps 码率（语音足够）
    #
    # 注意：capture_stderr=True 让 ffmpeg-python 捕获 stderr 输出，
    # 这样异常时能拿到真正的错误原因，而不是 "see stderr output for detail"
    try:
        (
            ffmpeg.input(str(video_path))
            .output(
                str(output_path),
                ac=1,                    # 单声道
                ar=sample_rate,          # 采样率
                acodec="libmp3lame",     # MP3 编码
                audio_bit_rate="64k",    # 64kbps 码率
                vn=None,                 # 不包含视频流
            )
            .overwrite_output()
            .run(capture_stderr=True)
        )
    except ffmpeg.Error as e:
        # 解码 ffmpeg 的 stderr 输出，记录真实错误原因
        stderr_output = e.stderr.decode("utf-8", errors="replace") if e.stderr else ""
        logger.error("ffmpeg 转换失败 (stderr):\n%s", stderr_output)
        raise RuntimeError(
            f"ffmpeg 音频提取失败: {stderr_output[-500:] if stderr_output else str(e)}"
        ) from e

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
