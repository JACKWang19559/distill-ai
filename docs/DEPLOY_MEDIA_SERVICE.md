# 媒体处理服务部署指南

## 背景

Distill 的 PDF / 抖音 / 小红书蒸馏功能依赖 Python 媒体处理服务（`services/media-processor`），该服务需要：

- **ffmpeg**：音频分离（视频 → WAV）
- **Java 11+**：opendataloader-pdf 的 JVM 依赖
- **yt-dlp**：视频下载
- **httpx**：调用云端 ASR API

这些系统级依赖无法在 Vercel Serverless Functions 上运行（50MB 包大小限制、无系统二进制、10-60s 超时），因此媒体服务必须独立部署。

## 部署方案：Render.com

Render.com 提供 Docker 容器部署，免费 Tier 包含：
- 512MB RAM
- 自动从 GitHub 部署
- 自定义域名
- 15 分钟无活动休眠（Demo 足够）

## 部署步骤

### 1. 推送代码到 GitHub

确保 `services/media-processor/` 目录已推送到 GitHub 仓库（已完成）。

### 2. 在 Render.com 创建服务

1. 访问 https://dashboard.render.com
2. 点击 **New** → **Web Service**
3. 连接 GitHub 仓库 `distill-ai`
4. 配置如下：

| 配置项 | 值 |
|--------|-----|
| Name | `distill-media-processor` |
| Runtime | **Docker** |
| Region | `Singapore`（离中国最近） |
| Branch | `main` |
| Root Directory | `services/media-processor` |
| Plan | **Free** |

5. 点击 **Create Web Service**

### 3. 配置环境变量

在 Render 服务的 **Environment** 页面添加以下变量：

#### 必填变量

| Key | Value | 说明 |
|-----|-------|------|
| `ASR_PROVIDER` | `cloud` | 使用云端 ASR |
| `CLOUD_ASR_PROVIDER` | `openai` | OpenAI Whisper API |
| `CLOUD_ASR_API_KEY` | `sk-xxx` | 你的 OpenAI API Key |

#### 可选变量

| Key | Value | 说明 |
|-----|-------|------|
| `DOUYIN_COOKIE` | （你的抖音 Cookie） | 反爬 |
| `XIAOHONGSHU_COOKIE` | （你的小红书 Cookie） | 反爬 |
| `LOG_LEVEL` | `INFO` | 日志级别 |

### 4. 等待部署完成

Render 会自动：
1. 拉取代码
2. 构建 Docker 镜像（约 5-10 分钟）
3. 启动容器
4. 运行健康检查 `/health`

部署成功后，你会得到一个公网 URL，格式如：
```
https://distill-media-processor.onrender.com
```

### 5. 验证服务

访问以下端点验证：

```bash
# 健康检查
curl https://distill-media-processor.onrender.com/health

# 预期返回
{
  "status": "ok",
  "version": "0.1.0",
  "services": {
    "ffmpeg": "ok",
    "java": "ok",
    "opendataloader_pdf": "ok",
    "whisper": "missing"  # 正常，我们用云端 ASR
  }
}
```

### 6. 在 Vercel 配置环境变量

1. 访问 Vercel 项目设置：https://vercel.com/dashboard → 选择 `distill-ai` 项目
2. 进入 **Settings** → **Environment Variables**
3. 添加：

| Key | Value | Environments |
|-----|-------|--------------|
| `MEDIA_SERVICE_URL` | `https://distill-media-processor.onrender.com` | Production, Preview, Development |

4. **重新部署** Vercel 项目（让新环境变量生效）

### 7. 测试线上功能

登录 https://distill-ai.vercel.app ，测试：
- PDF 蒸馏：上传 PDF 文件
- 抖音蒸馏：粘贴抖音视频链接
- 小红书蒸馏：粘贴小红书笔记链接

## 架构说明

```
┌─────────────────┐         ┌──────────────────────┐
│   用户浏览器     │         │   Chrome 扩展         │
└────────┬────────┘         └───────────┬──────────┘
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────────────┐
│         Vercel (Next.js 16 + React 19)              │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ /api/distill │  │ /api/upload │  │ /api/auth  │  │
│  └──────┬──────┘  └─────────────┘  └────────────┘  │
│         │                                           │
│         │ MEDIA_SERVICE_URL                         │
│         ▼                                           │
└─────────────────────────────────────────────────────┘
          │
          │ HTTPS (公网)
          ▼
┌─────────────────────────────────────────────────────┐
│      Render.com (Python FastAPI + Docker)           │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ /pdf/extract │  │ /media/     │  │ /media/    │  │
│  │              │  │ douyin      │  │ xiaohongshu│  │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │               │          │
│         ▼                ▼               ▼          │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐     │
│  │ opendata- │   │ yt-dlp +  │   │ requests  │     │
│  │ loader-pdf│   │ ffmpeg    │   │ + bs4     │     │
│  │ (Java)    │   │           │   │           │     │
│  └───────────┘   └─────┬─────┘   └───────────┘     │
│                        │                            │
│                        ▼                            │
│                 ┌──────────────┐                    │
│                 │ OpenAI API   │                    │
│                 │ (Whisper)    │                    │
│                 └──────────────┘                    │
└─────────────────────────────────────────────────────┘
```

## 故障排查

### 问题：健康检查返回 `whisper: missing`

**正常**。生产环境使用云端 ASR（OpenAI Whisper API），不需要本地 Whisper。

### 问题：PDF 蒸馏失败，报错 `opendataloader_pdf: missing`

检查 Render 构建日志，确认 `pip install opendataloader-pdf` 成功。如失败，可能是网络问题，重新触发部署。

### 问题：抖音/小红书蒸馏超时

Render Free Tier 有请求超时限制（约 5 分钟）。长视频可能超时。解决方案：
- 升级到 Paid Plan（超时 30 分钟）
- 或限制视频时长（`MAX_VIDEO_DURATION=600`）

### 问题：服务休眠后首次请求慢

Render Free Tier 15 分钟无活动会休眠，首次请求需要冷启动（约 30-50 秒）。解决方案：
- 升级到 Paid Plan（无休眠）
- 或用 cron-job.org 定时 ping `/health` 端点

### 问题：Vercel 调用媒体服务报 `fetch failed`

1. 确认 `MEDIA_SERVICE_URL` 环境变量已在 Vercel 配置
2. 确认 URL 格式正确（无尾部斜杠）
3. 确认 Render 服务已启动（访问 `/health`）
4. 检查 Vercel 函数日志（可能超时）

## 本地开发

```bash
# 启动媒体服务
cd services/media-processor
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 启动 Next.js（另一个终端）
cd apps/web
pnpm dev

# Next.js 会自动使用 http://localhost:8001 作为 MEDIA_SERVICE_URL
```

## 成本估算

| 服务 | 免费额度 | 超出后 |
|------|---------|--------|
| Render.com | 512MB RAM，15min 休眠 | $7/月（无休眠） |
| Vercel | 100GB 带宽，100h 函数 | $20/月（Pro） |
| OpenAI Whisper API | 前 5 分钟免费 | $0.006/分钟 |
| Supabase | 500MB DB，50GB 带宽 | $25/月 |

**Demo 阶段总成本：$0**
