# ============================================================================
# Distill 媒体处理服务 Dockerfile
# 基于 Python 3.11-slim，包含 ffmpeg 和 Java（opendataloader-pdf 依赖）
#
# 优化点：
# - 使用 python:3.11-slim 减小基础镜像体积
# - 多阶段构建分离编译依赖
# - 注释 openai-whisper，改用云端 ASR API（节省 ~2GB）
# - 合并 RUN 层减少镜像层数
# ============================================================================

FROM python:3.11-slim AS builder

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装构建依赖（仅构建阶段需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖到 /install 目录（便于多阶段复制）
RUN pip install --no-cache-dir --target=/install -r requirements.txt


# ============================================================================
# 运行阶段镜像
# ============================================================================
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app:/install

# 安装运行时系统依赖
# ffmpeg: 音频分离（抖音/小红书视频处理）
# default-jre: Java 运行时（opendataloader-pdf 依赖）
# curl: 健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    default-jre \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从 builder 阶段复制已安装的 Python 包
COPY --from=builder /install /install

# 复制项目代码
COPY . .

# 创建临时目录
RUN mkdir -p /app/tmp /app/uploads

# 暴露端口（Render 会通过 PORT 环境变量覆盖）
EXPOSE 8001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

# 启动命令
# Render 会注入 PORT 环境变量，使用 ${PORT:-8001} 兼容本地和云端
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
