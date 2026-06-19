"""Pydantic 数据模型定义。

定义所有 API 请求和响应的数据结构，
用于 FastAPI 自动生成 OpenAPI 文档和参数校验。
"""

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


# ============================================================================
# 抖音视频处理
# ============================================================================


class DouyinRequest(BaseModel):
    """抖音视频处理请求。

    Attributes:
        url: 抖音视频分享链接
        cookie: 可选 Cookie，用于反爬
        task_id: 任务 ID，用于隔离临时文件
        extract_audio_only: 是否仅提取音频不进行 ASR
    """

    url: str = Field(..., description="抖音视频分享链接", examples=["https://v.douyin.com/xxx/"])
    cookie: str | None = Field(None, description="可选 Cookie，用于反爬")
    task_id: str = Field(..., description="任务 ID，用于隔离临时文件")
    extract_audio_only: bool = Field(False, description="是否仅提取音频不进行 ASR")


class DouyinResponse(BaseModel):
    """抖音视频处理响应。

    Attributes:
        transcript: ASR 转写文本（extract_audio_only=True 时为空）
        title: 视频标题
        author: 作者昵称
        duration: 视频时长（秒）
        audio_url: 音频文件 URL（extract_audio_only=True 时返回）
    """

    transcript: str = Field("", description="ASR 转写文本")
    title: str = Field("", description="视频标题")
    author: str = Field("", description="作者昵称")
    duration: int = Field(0, description="视频时长（秒）")
    audio_url: str | None = Field(None, description="音频文件 URL")


# ============================================================================
# 小红书笔记处理
# ============================================================================


class XiaohongshuRequest(BaseModel):
    """小红书笔记处理请求。

    Attributes:
        url: 小红书笔记链接
        cookie: 可选 Cookie
        task_id: 任务 ID
    """

    url: str = Field(..., description="小红书笔记链接")
    cookie: str | None = Field(None, description="可选 Cookie")
    task_id: str = Field(..., description="任务 ID")


class XiaohongshuResponse(BaseModel):
    """小红书笔记处理响应。

    Attributes:
        note_type: 笔记类型（image/video）
        title: 笔记标题
        content: 笔记正文
        transcript: 视频笔记的 ASR 转写文本（图文笔记为空）
        author: 作者昵称
        video_url: 视频笔记的视频地址
        tags: 标签列表
        ip_location: IP 归属地
        liked_count: 点赞数
        collected_count: 收藏数
        comment_count: 评论数
    """

    note_type: Literal["image", "video"] = Field(..., description="笔记类型")
    title: str = Field("", description="笔记标题")
    content: str = Field("", description="笔记正文")
    transcript: str = Field("", description="视频笔记的 ASR 转写文本")
    author: str = Field("", description="作者昵称")
    video_url: str | None = Field(None, description="视频笔记的视频地址")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    ip_location: str = Field("", description="IP 归属地")
    liked_count: str = Field("", description="点赞数")
    collected_count: str = Field("", description="收藏数")
    comment_count: str = Field("", description="评论数")


# ============================================================================
# ASR 语音识别
# ============================================================================


class ASRRequest(BaseModel):
    """ASR 语音识别请求。

    Attributes:
        audio_path: 音频文件路径（服务端路径）
        provider: ASR 供应商（可选，默认使用配置）
    """

    audio_path: str = Field(..., description="音频文件路径")
    provider: Literal["whisper-local", "cloud"] | None = Field(
        None, description="ASR 供应商，默认使用配置"
    )


class ASRResponse(BaseModel):
    """ASR 语音识别响应。

    Attributes:
        transcript: 转写文本
        provider: 实际使用的供应商
        duration: 音频时长（秒）
    """

    transcript: str = Field(..., description="转写文本")
    provider: str = Field(..., description="实际使用的供应商")
    duration: float = Field(0, description="音频时长（秒）")


# ============================================================================
# PDF 解析
# ============================================================================


class PDFExtractResponse(BaseModel):
    """PDF 解析响应。

    Attributes:
        markdown: 提取的 Markdown 文本
        page_count: 页数
        format: 输出格式
        used_hybrid: 是否使用了 Hybrid 模式
    """

    markdown: str = Field(..., description="提取的 Markdown 文本")
    page_count: int = Field(0, description="页数")
    format: str = Field("markdown", description="输出格式")
    used_hybrid: bool = Field(False, description="是否使用了 Hybrid 模式")


# ============================================================================
# 通用响应
# ============================================================================


class HealthResponse(BaseModel):
    """健康检查响应。

    Attributes:
        status: 服务状态
        version: 服务版本
        services: 各子服务状态
    """

    status: Literal["ok", "degraded"] = Field(..., description="服务状态")
    version: str = Field(..., description="服务版本")
    services: dict[str, str] = Field(default_factory=dict, description="各子服务状态")


class ErrorResponse(BaseModel):
    """错误响应。

    Attributes:
        error: 错误类型
        message: 错误详情
        detail: 额外信息（可选）
    """

    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误详情")
    detail: Any | None = Field(None, description="额外信息")
