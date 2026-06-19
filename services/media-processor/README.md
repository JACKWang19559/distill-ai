# Distill 媒体处理服务

AI 知识蒸馏站的 Python 媒体处理微服务，提供抖音视频、小红书笔记、PDF 文档的解析与转写能力。

## 功能特性

| 功能 | 端点 | 说明 |
|------|------|------|
| 抖音视频处理 | `POST /media/douyin` | 下载视频 → 分离音频 → ASR 转写 |
| 小红书笔记处理 | `POST /media/xiaohongshu` | 提取图文/视频笔记内容 |
| ASR 语音识别 | `POST /media/asr` | 独立音频转写接口 |
| PDF 解析 | `POST /pdf/extract` | 使用 opendataloader-pdf 提取 Markdown |
| 健康检查 | `GET /health` | 服务状态和依赖检查 |
| API 文档 | `GET /docs` | Swagger UI 自动生成 |

## 技术栈

- **Web 框架**: FastAPI 0.110
- **视频下载**: yt-dlp（支持抖音/小红书等多平台）
- **音频分离**: ffmpeg-python（输出 WAV 16kHz 单声道）
- **PDF 解析**: opendataloader-pdf（Apache 2.0，Benchmark #1）
- **ASR 语音识别**: openai-whisper（本地兜底）+ 云端 API
- **网页解析**: BeautifulSoup4（小红书内容提取）

## 系统依赖

| 依赖 | 用途 | 安装方式 |
|------|------|----------|
| Python 3.10+ | 运行环境 | - |
| ffmpeg | 音频分离 | `apt install ffmpeg` / `brew install ffmpeg` |
| Java 11+ | opendataloader-pdf 依赖 | [Adoptium](https://adoptium.net/) |

## 快速开始

### 1. 安装依赖

```bash
# 进入服务目录
cd services/media-processor

# 创建虚拟环境
py -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/macOS

# 安装 Python 依赖
py -m pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 复制环境变量示例文件
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/macOS

# 编辑 .env 文件，按需修改配置
```

### 3. 启动服务

```bash
# 开发模式（热重载）
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 生产模式
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 4. 验证服务

```bash
# 健康检查
curl http://localhost:8001/health

# 查看 API 文档
# 浏览器打开 http://localhost:8001/docs
```

## Docker 部署

### 单独启动媒体处理服务

```bash
cd services/media-processor
docker build -t distill-media-processor .
docker run -p 8001:8001 --env-file .env distill-media-processor
```

### 使用 Docker Compose 启动全部服务

```bash
# 在项目根目录
docker-compose up -d
```

## API 使用示例

### 抖音视频处理

```bash
curl -X POST http://localhost:8001/media/douyin \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://v.douyin.com/xxx/",
    "task_id": "task-001",
    "cookie": ""
  }'
```

响应：
```json
{
  "transcript": "视频转写文本...",
  "title": "视频标题",
  "author": "作者昵称",
  "duration": 60,
  "audio_url": null
}
```

### PDF 解析

```bash
curl -X POST http://localhost:8001/pdf/extract \
  -F "file=@document.pdf" \
  -F "use_hybrid=false"
```

响应：
```json
{
  "markdown": "# 文档标题\n\n正文内容...",
  "page_count": 10,
  "format": "markdown",
  "used_hybrid": false
}
```

### 小红书笔记处理

```bash
curl -X POST http://localhost:8001/media/xiaohongshu \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.xiaohongshu.com/explore/xxx",
    "task_id": "task-002"
  }'
```

## opendataloader-pdf Hybrid 模式

Hybrid 模式支持扫描件 OCR、复杂表格、数学公式识别，准确率 #1（0.907）。

### 启用 Hybrid 模式

1. 安装 Hybrid 扩展：
```bash
pip install "opendataloader-pdf[hybrid]"
```

2. 启动 Hybrid 后端服务：
```bash
opendataloader-pdf-hybrid --port 5002
```

3. 在 `.env` 中配置：
```env
PDF_HYBRID_MODE=true
PDF_HYBRID_BACKEND=docling-fast
```

### OCR 配置（扫描件）

```bash
# 启动带 OCR 的 Hybrid 服务
opendataloader-pdf-hybrid --port 5002 --force-ocr

# 中文扫描件
opendataloader-pdf-hybrid --port 5002 --force-ocr --ocr-lang "ch_sim,en"
```

## 项目结构

```
services/media-processor/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI 主入口
│   ├── config.py             # 配置管理
│   ├── api/                  # API 路由
│   │   ├── douyin.py         # 抖音视频处理
│   │   ├── xiaohongshu.py    # 小红书笔记处理
│   │   ├── asr.py            # ASR 语音识别
│   │   └── pdf.py            # PDF 解析
│   ├── core/                 # 核心业务逻辑
│   │   ├── downloader.py     # 视频下载器
│   │   ├── audio_extractor.py # 音频分离
│   │   ├── asr_provider.py   # ASR 供应商适配
│   │   ├── pdf_extractor.py  # PDF 解析
│   │   └── xhs_extractor.py  # 小红书内容提取
│   ├── schemas/              # Pydantic 数据模型
│   │   └── media.py
│   └── utils/                # 工具函数
│       └── cleanup.py        # 临时文件清理
├── requirements.txt
├── pyproject.toml
├── Dockerfile
├── .env.example
└── README.md
```

## 代码规范

- 遵循 PEP 8 规范（使用 ruff + black 强制）
- 所有代码包含注释和 docstring
- Python 命令以 `py` 开头（如 `py -m pytest`、`py -m uvicorn`）

## 开发命令

```bash
# 代码格式化
py -m black app/

# 代码检查
py -m ruff check app/

# 运行测试（待添加）
py -m pytest tests/
```
