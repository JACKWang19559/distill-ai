# ============================================================================
# Distill 媒体处理服务 Dockerfile
# 基于 Python 3.10，包含 ffmpeg 和 Java（opendataloader-pdf 依赖）
# ============================================================================

FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖
# ffmpeg: 音频分离
# default-jre: Java 运行时（opendataloader-pdf 依赖）
# curl: 健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    default-jre \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
# 注意：openai-whisper 依赖 torch，体积较大
# 如仅使用云端 ASR，可在 requirements.txt 中注释 openai-whisper
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目代码
COPY . .

# 创建临时目录
RUN mkdir -p /app/tmp /app/uploads

# 暴露端口
EXPOSE 8001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# 启动命令
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
