"""ASR 语音识别供应商适配模块。

支持多供应商切换：
- whisper-local: 本地 Whisper 模型（兜底方案，无需网络）
- cloud: 云端 ASR API（通义听悟/讯飞/OpenAI Whisper API）

使用工厂模式根据配置动态创建供应商实例。
"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)


class ASRProvider(ABC):
    """ASR 供应商抽象基类。

    所有 ASR 供应商需实现 transcribe 方法。
    """

    @abstractmethod
    def transcribe(self, audio_path: Path) -> str:
        """将音频转写为文本。

        Args:
            audio_path: 音频文件路径（建议 WAV 16kHz 单声道）

        Returns:
            转写文本

        Raises:
            Exception: 转写失败
        """
        ...


class WhisperLocalProvider(ASRProvider):
    """本地 Whisper 模型供应商。

    使用 openai-whisper 库在本地运行模型，
    无需网络，但首次加载需要下载模型权重。
    """

    def __init__(self, model_size: str = "base"):
        """初始化 Whisper 模型。

        首次加载会从 HuggingFace 下载模型权重到本地缓存。

        Args:
            model_size: 模型大小
                - tiny: 最快，精度最低（~1GB）
                - base: 速度与精度平衡（~1.4GB，推荐中文）
                - small: 精度较高（~2.4GB）
                - medium: 高精度（~4.8GB）
                - large: 最高精度（~6.8GB）
        """
        import whisper  # 延迟导入，避免服务启动时加载模型

        logger.info("加载 Whisper 本地模型: %s", model_size)
        self.model = whisper.load_model(model_size)
        self.model_size = model_size
        logger.info("Whisper 模型加载完成")

    def transcribe(self, audio_path: Path) -> str:
        """使用本地 Whisper 转写音频。

        Args:
            audio_path: 音频文件路径

        Returns:
            转写文本
        """
        logger.info("开始本地 Whisper 转写: %s", audio_path)

        # language="zh" 强制中文识别，提高中文准确率
        # task="transcribe" 指定转写任务（而非翻译）
        result = self.model.transcribe(
            str(audio_path),
            language="zh",
            task="transcribe",
            verbose=False,
        )

        text = result.get("text", "").strip()
        logger.info("Whisper 转写完成, 文本长度: %d", len(text))
        return text


class CloudASRProvider(ASRProvider):
    """云端 ASR 供应商。

    支持通义听悟、讯飞、OpenAI Whisper API 等云端服务。
    精度通常高于本地模型，但需要网络和 API Key。
    """

    def __init__(self, provider: str, api_key: str, api_url: str = ""):
        """初始化云端 ASR 客户端。

        Args:
            provider: 供应商名称（tongyi/xunfei/openai）
            api_key: API Key
            api_url: API 地址（部分供应商需要）
        """
        self.provider = provider
        self.api_key = api_key
        self.api_url = api_url
        logger.info("初始化云端 ASR 供应商: %s", provider)

    def transcribe(self, audio_path: Path) -> str:
        """调用云端 ASR API 转写音频。

        根据供应商类型路由到不同的实现。

        Args:
            audio_path: 音频文件路径

        Returns:
            转写文本

        Raises:
            ValueError: 不支持的供应商
            Exception: API 调用失败
        """
        if self.provider == "openai":
            return self._transcribe_with_openai(audio_path)
        elif self.provider == "tongyi":
            return self._transcribe_with_tongyi(audio_path)
        elif self.provider == "xunfei":
            return self._transcribe_with_xunfei(audio_path)
        else:
            raise ValueError(f"不支持的云端 ASR 供应商: {self.provider}")

    def _transcribe_with_openai(self, audio_path: Path) -> str:
        """使用 OpenAI Whisper API 转写。

        Args:
            audio_path: 音频文件路径

        Returns:
            转写文本
        """
        import httpx

        # OpenAI Whisper API 端点
        api_url = self.api_url or "https://api.openai.com/v1/audio/transcriptions"

        logger.info("调用 OpenAI Whisper API: %s", audio_path)

        with open(audio_path, "rb") as audio_file:
            files = {"file": (audio_path.name, audio_file, "audio/wav")}
            data = {
                "model": "whisper-1",
                "language": "zh",
                "response_format": "text",
            }
            headers = {
                "Authorization": f"Bearer {self.api_key}",
            }

            with httpx.Client(timeout=300) as client:
                response = client.post(api_url, files=files, data=data, headers=headers)
                response.raise_for_status()

                text = response.text.strip()
                logger.info("OpenAI Whisper API 转写完成, 文本长度: %d", len(text))
                return text

    def _transcribe_with_tongyi(self, audio_path: Path) -> str:
        """使用通义听悟 API 转写。

        通义听悟需要先上传文件，再创建转写任务，最后轮询结果。
        此处为简化实现，实际使用时需根据官方 SDK 调整。

        Args:
            audio_path: 音频文件路径

        Returns:
            转写文本

        Note:
            TODO: 接入通义听悟官方 SDK
        """
        logger.warning("通义听悟 ASR 尚未完整实现，请使用 openai 或 whisper-local")
        raise NotImplementedError("通义听悟 ASR 待实现")

    def _transcribe_with_xunfei(self, audio_path: Path) -> str:
        """使用讯飞语音识别 API 转写。

        讯飞采用 WebSocket 协议，需要分段上传音频。
        此处为简化实现，实际使用时需根据官方 SDK 调整。

        Args:
            audio_path: 音频文件路径

        Returns:
            转写文本

        Note:
            TODO: 接入讯飞官方 SDK
        """
        logger.warning("讯飞 ASR 尚未完整实现，请使用 openai 或 whisper-local")
        raise NotImplementedError("讯飞 ASR 待实现")


# ============================================================================
# 工厂函数
# ============================================================================


def get_asr_provider(provider: str | None = None) -> ASRProvider:
    """根据配置获取 ASR 供应商实例。

    优先级：
    1. 显式传入的 provider 参数
    2. 配置文件中的 ASR_PROVIDER

    降级策略：
    - 若选择 whisper-local 但 openai-whisper 未安装，自动降级为云端 ASR
    - 若云端 ASR 未配置 API Key，抛出明确错误

    Args:
        provider: 显式指定的供应商（可选）

    Returns:
        ASRProvider 实例

    Raises:
        ValueError: 不支持的供应商，或所有供应商均不可用
    """
    provider = provider or settings.ASR_PROVIDER

    if provider == "whisper-local":
        try:
            import whisper  # noqa: F401

            return WhisperLocalProvider(model_size=settings.WHISPER_MODEL_SIZE)
        except ImportError:
            logger.warning(
                "openai-whisper 未安装，尝试降级为云端 ASR。"
                "如需本地 ASR，请 pip install openai-whisper"
            )
            if not settings.CLOUD_ASR_API_KEY:
                raise ValueError(
                    "本地 Whisper 未安装且云端 ASR 未配置 API Key。"
                    "请设置 CLOUD_ASR_API_KEY 环境变量，或安装 openai-whisper"
                )
            return CloudASRProvider(
                provider=settings.CLOUD_ASR_PROVIDER,
                api_key=settings.CLOUD_ASR_API_KEY,
                api_url=settings.CLOUD_ASR_API_URL,
            )
    elif provider == "cloud":
        if not settings.CLOUD_ASR_API_KEY:
            logger.warning("云端 ASR 未配置 API Key，降级为本地 Whisper")
            try:
                return WhisperLocalProvider(model_size=settings.WHISPER_MODEL_SIZE)
            except ImportError as e:
                raise ValueError(
                    "云端 ASR 未配置 API Key 且本地 Whisper 未安装"
                ) from e
        return CloudASRProvider(
            provider=settings.CLOUD_ASR_PROVIDER,
            api_key=settings.CLOUD_ASR_API_KEY,
            api_url=settings.CLOUD_ASR_API_URL,
        )
    else:
        raise ValueError(f"不支持的 ASR 供应商: {provider}")
