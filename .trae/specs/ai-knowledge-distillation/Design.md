# Distill - AI 知识蒸馏站 设计文档（Design）

> **版本**：v1.0 (MVP)
> **创建日期**：2026-06-17
> **关联 PRD**：[PRD.md](./PRD.md)
> **UI 设计参考**：[21st.dev 组件库](https://21st.dev/community/components)

---

## 一、系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层 (User Layer)                      │
├───────────────────────────┬─────────────────────────────────────┤
│   Chrome Extension        │      Web App (Next.js 14)           │
│   ─────────────────       │      ──────────────────             │
│   · Content Script        │      · 知识库管理                    │
│     (页面内容提取)         │      · 全文搜索                      │
│   · Side Panel UI         │      · 知识图谱可视化                │
│     (蒸馏交互)            │      · 蒸馏详情查看                  │
│   · Background SW         │      · 标签/分类管理                 │
│     (API 通信)            │      · 用户设置                     │
│   · Context Menu          │      · 文件上传                     │
└──────────┬────────────────┴──────────────┬──────────────────────┘
           │                              │
           │        HTTPS REST            │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API 层 (Next.js API Routes)                    │
│  ────────────────────────────────────────────────────────────   │
│  · /api/auth/*           认证 (NextAuth.js)                     │
│  · /api/distill/*        蒸馏任务 (创建/查询/列表)              │
│  · /api/knowledge/*      知识库 CRUD                            │
│  · /api/search           全文搜索                                │
│  · /api/graph            知识图谱查询                            │
│  · /api/tags/*           标签管理                                │
│  · /api/upload           文件上传 (PDF/TXT/MD)                  │
│  · /api/settings/*       用户设置与 API 配置                    │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ├─────────────────────────────────┐
           │                                 ▼
           ▼                    ┌─────────────────────────────────────┐
┌──────────────────────┐        │  Python 媒体处理服务 (FastAPI)      │
│  服务层 (Service)    │        │  ───────────────────────────────    │
│  ────────────────    │ HTTP   │  · /media/douyin     抖音视频下载   │
│  · DistillService    │◄──────►│  · /media/xiaohongshu 小红书提取    │
│    蒸馏编排          │        │  · /media/asr         音频识别      │
│  · AIProviderAdapter │        │  · /pdf/extract       PDF 解析      │
│    多供应商适配器    │        │    (opendataloader-pdf)             │
│  · KnowledgeGraph    │        │  · /health            健康检查      │
│  · SearchService     │        └──────────┬──────────────────────────┘
│  · StorageService    │                   │
│  · AuthService       │                   │
└──────────┬───────────┘                   │
           │                               ▼
           ▼                   ┌─────────────────────────────────────┐
┌─────────────────────────────────────────┐│  外部服务             │
│           数据层 (Data Layer)           ││  ─────────────────    │
├──────────────────┬──────────────────┬───┤│  · 抖音 CDN           │
│   PostgreSQL     │  本地文件存储     │   ││  · 小红书 CDN         │
│  ────────────    │  ────────────    │   ││  · ASR API            │
│  · users         │  · 上传的 PDF    │   ││    (通义听悟/讯飞/    │
│  · knowledge     │  · 临时视频/音频 │   │└─►  Whisper)           │
│  · tags          │    (处理完即删)  │   │  · opendataloader-pdf │
│  · connections   │                  │   │    Hybrid Server      │
│  · api_configs   │                  │   │
│  · ai_usage      │                  │   │
└──────────────────┴──────────────────┴───┘
```

### 1.2 技术栈

| 层级 | 技术选型 | 版本 | 理由 |
|------|----------|------|------|
| 前端框架 | Next.js (App Router) | 14.2.x | 与 API 统一，SSR + RSC |
| UI 库 | React + shadcn/ui | 18.3.x / latest | 基于 21st.dev 设计参考 |
| 样式 | Tailwind CSS | 3.x | 原子化 CSS，快速开发 |
| 图谱可视化 | React Flow (@xyflow/react) | 12.x | 轻量、可交互 |
| 后端 | Next.js API Routes | 14.2.x | 与前端统一部署 |
| ORM | Prisma | 5.x | 类型安全，迁移管理 |
| 数据库 | PostgreSQL | 15+ | 关系型 + 全文搜索 |
| 认证 | NextAuth.js | 4.24.x | 多 Provider，开箱即用 |
| 校验 | Zod | 3.x | Schema 校验 + 类型推导 |
| 浏览器插件 | Vite + CRXJS | 5.x / latest | HMR 支持，开发体验好 |
| **Python 媒体服务** | **FastAPI** | **0.110+** | **异步高性能，自动生成 OpenAPI 文档** |
| **PDF 解析** | **opendataloader-pdf** | **latest** | **Apache 2.0，benchmark #1，支持 OCR/表格/公式** |
| **视频下载** | **yt-dlp** | **latest** | **支持抖音/小红书等多平台视频下载** |
| **音频分离** | **ffmpeg-python** | **0.2+** | **可靠的音视频处理工业标准** |
| **ASR 语音识别** | **openai-whisper / 云端 ASR API** | **latest** | **Whisper 本地兜底 + 云端 API 高精度** |
| **小红书内容提取** | **requests + BeautifulSoup** | **latest** | **轻量级 HTML 解析** |
| 包管理 | pnpm + Turborepo | latest | Monorepo 编排 |
| 语言 | TypeScript + Python | 5.x / 3.10+ | 全栈类型安全 + AI/媒体生态 |

---

## 二、项目结构

```
e:\#2026AI_TRAE_创造力大赛\
├── apps/
│   ├── web/                          # Next.js 主应用（Web 端 + API）
│   │   ├── src/
│   │   │   ├── app/                  # App Router
│   │   │   │   ├── (auth)/           # 登录/注册页
│   │   │   │   │   ├── login/
│   │   │   │   │   └── register/
│   │   │   │   ├── (dashboard)/      # 主工作区（需登录）
│   │   │   │   │   ├── layout.tsx    # 工作区布局（侧边栏 + 顶栏）
│   │   │   │   │   ├── page.tsx      # 首页（快速蒸馏入口）
│   │   │   │   │   ├── library/      # 知识库列表
│   │   │   │   │   ├── knowledge/    # 知识详情
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   ├── graph/        # 知识图谱
│   │   │   │   │   ├── search/       # 搜索
│   │   │   │   │   └── settings/     # 设置
│   │   │   │   ├── api/              # API Routes
│   │   │   │   │   ├── auth/[...nextauth]/
│   │   │   │   │   ├── distill/
│   │   │   │   │   │   ├── route.ts        # POST 创建蒸馏
│   │   │   │   │   │   └── [id]/route.ts   # GET 查询状态
│   │   │   │   │   ├── knowledge/
│   │   │   │   │   │   ├── route.ts
│   │   │   │   │   │   └── [id]/route.ts
│   │   │   │   │   ├── search/route.ts
│   │   │   │   │   ├── graph/route.ts
│   │   │   │   │   ├── tags/route.ts
│   │   │   │   │   ├── upload/route.ts
│   │   │   │   │   └── settings/api-configs/route.ts
│   │   │   │   └── layout.tsx        # 根布局
│   │   │   ├── components/           # React 组件
│   │   │   │   ├── ui/               # shadcn/ui 基础组件
│   │   │   │   ├── layout/           # 布局组件（Sidebar, Header）
│   │   │   │   ├── knowledge/        # 知识库相关
│   │   │   │   │   ├── KnowledgeCard.tsx
│   │   │   │   │   ├── KnowledgeList.tsx
│   │   │   │   │   ├── KnowledgeDetail.tsx
│   │   │   │   │   └── TagFilter.tsx
│   │   │   │   ├── graph/            # 图谱可视化
│   │   │   │   │   ├── KnowledgeGraph.tsx
│   │   │   │   │   ├── GraphNode.tsx
│   │   │   │   │   └── GraphControls.tsx
│   │   │   │   ├── distill/          # 蒸馏相关
│   │   │   │   │   ├── DistillForm.tsx
│   │   │   │   │   ├── DistillResult.tsx
│   │   │   │   │   └── DistillProgress.tsx
│   │   │   │   └── settings/         # 设置相关
│   │   │   ├── lib/                  # 工具库
│   │   │   │   ├── ai/               # AI 供应商适配器
│   │   │   │   │   ├── provider.ts          # 统一接口
│   │   │   │   │   ├── openai.ts
│   │   │   │   │   ├── anthropic.ts
│   │   │   │   │   ├── qwen.ts
│   │   │   │   │   ├── deepseek.ts
│   │   │   │   │   ├── zhipu.ts
│   │   │   │   │   ├── factory.ts           # 工厂 + 路由
│   │   │   │   │   └── prompts.ts           # Prompt 模板
│   │   │   │   ├── db/               # Prisma 客户端
│   │   │   │   │   └── index.ts
│   │   │   │   ├── auth/             # 认证配置
│   │   │   │   │   ├── config.ts
│   │   │   │   │   └── session.ts
│   │   │   │   ├── extractor/        # 内容提取
│   │   │   │   │   ├── url.ts        # URL 内容提取
│   │   │   │   │   ├── pdf.ts        # PDF 文本提取（调用 Python 服务）
│   │   │   │   │   ├── video.ts      # 视频/音频处理（调用 Python 服务）
│   │   │   │   │   └── cleaner.ts    # 清洗
│   │   │   │   ├── media/            # Python 媒体服务客户端
│   │   │   │   │   └── client.ts     # HTTP 客户端封装
│   │   │   │   ├── crypto/           # 加密工具
│   │   │   │   │   └── index.ts      # AES-256-GCM
│   │   │   │   └── utils/            # 通用工具
│   │   │   ├── services/             # 业务服务层
│   │   │   │   ├── distill.service.ts
│   │   │   │   ├── knowledge.service.ts
│   │   │   │   ├── graph.service.ts
│   │   │   │   ├── search.service.ts
│   │   │   │   └── settings.service.ts
│   │   │   ├── hooks/                # React Hooks
│   │   │   └── types/                # TypeScript 类型定义
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # 数据库 Schema
│   │   │   └── migrations/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── extension/                    # Chrome 扩展
│       ├── src/
│       │   ├── background/           # Service Worker
│       │   │   └── index.ts          # 消息处理 + API 通信
│       │   ├── content/              # 内容脚本
│       │   │   ├── extractor.ts      # Readability 提取
│       │   │   └── index.ts
│       │   ├── sidepanel/            # 侧边栏 UI
│       │   │   ├── App.tsx
│       │   │   ├── main.tsx
│       │   │   └── index.html
│       │   ├── popup/                # 弹窗
│       │   │   ├── App.tsx
│       │   │   └── index.html
│       │   ├── components/           # 共享组件
│       │   │   ├── DistillPanel.tsx
│       │   │   └── ResultView.tsx
│       │   ├── lib/
│       │   │   ├── api.ts            # 与后端 API 通信
│       │   │   ├── auth.ts           # 登录态管理
│       │   │   └── storage.ts        # chrome.storage
│       │   └── types/
│       ├── manifest.json             # Manifest V3
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   └── shared/                       # 共享类型与工具
│       ├── src/
│       │   ├── types/                # 前后端共享类型
│       │   │   ├── knowledge.ts
│       │   │   ├── distill.ts
│       │   │   └── api.ts
│       │   └── constants/
│       └── package.json
│
├── services/                         # 独立微服务
│   └── media-processor/              # Python 媒体处理服务
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py               # FastAPI 入口
│       │   ├── api/                  # API 路由
│       │   │   ├── __init__.py
│       │   │   ├── douyin.py         # 抖音视频下载
│       │   │   ├── xiaohongshu.py    # 小红书内容提取
│       │   │   ├── asr.py            # 语音识别
│       │   │   └── pdf.py            # PDF 解析（opendataloader-pdf）
│       │   ├── core/                 # 核心业务逻辑
│       │   │   ├── __init__.py
│       │   │   ├── downloader.py     # 视频下载器（yt-dlp 封装）
│       │   │   ├── audio_extractor.py # 音频分离（ffmpeg）
│       │   │   ├── asr_provider.py   # ASR 供应商适配
│       │   │   ├── pdf_extractor.py  # PDF 解析（opendataloader-pdf）
│       │   │   └── xhs_extractor.py  # 小红书内容提取
│       │   ├── schemas/              # Pydantic 数据模型
│       │   │   ├── __init__.py
│       │   │   └── media.py
│       │   ├── config.py             # 配置管理
│       │   └── utils/                # 工具函数
│       │       ├── __init__.py
│       │       └── cleanup.py        # 临时文件清理
│       ├── tests/                    # 测试
│       │   ├── __init__.py
│       │   ├── test_douyin.py
│       │   ├── test_xiaohongshu.py
│       │   ├── test_asr.py
│       │   └── test_pdf.py
│       ├── requirements.txt          # Python 依赖
│       ├── pyproject.toml            # 项目配置（ruff/black）
│       ├── Dockerfile                # Python 服务容器化
│       └── README.md
│
├── package.json                      # monorepo 根配置
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml                # 一键启动 Web + Python + PostgreSQL
├── .env.example
├── .gitignore
└── README.md
```

---

## 三、数据库设计

### 3.1 ER 图

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    User      │     │  ApiConfig   │     │   Knowledge      │
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id (PK)      │◄──┐ │ id (PK)      │  ┌─►│ id (PK)          │
│ email        │   └─│ userId (FK)  │  │  │ userId (FK)      │
│ name         │     │ provider     │  │  │ title            │
│ image        │     │ apiKey (enc) │  │  │ sourceType       │
│ emailVerified│     │ model        │  │  │ sourceUrl        │
│ createdAt    │     │ isActive     │  │  │ rawContent       │
│ updatedAt    │     │ createdAt    │  │  │ summary          │
└──────┬───────┘     └──────────────┘  │  │ outline (JSON)   │
       │                               │  │ mindMap (JSON)   │
       │                               │  │ keyPoints (JSON) │
       │                               │  │ entities (JSON)  │
       │                               │  │ status           │
       │                               │  │ wordCount        │
       │                               │  │ readingTime      │
       │                               │  │ distillTime      │
       │                               │  │ tokensUsed       │
       │                               │  │ createdAt        │
       │                               │  │ updatedAt        │
       │                               │  └──────┬───────────┘
       │                               │         │
       │                               │         │
       │     ┌──────────────────┐      │         │
       │     │       Tag        │      │         │
       │     ├──────────────────┤      │         │
       ├────►│ id (PK)          │      │         │
       │     │ userId (FK)      │      │         │
       │     │ name             │      │         │
       │     │ color            │      │         │
       │     │ createdAt        │      │         │
       │     └──────┬───────────┘      │         │
       │            │                  │         │
       │            │                  │         │
       │     ┌──────▼───────────┐      │         │
       │     │ KnowledgeTag     │      │         │
       │     ├──────────────────┤      │         │
       │     │ knowledgeId (FK) │◄─────┘         │
       │     │ tagId (FK)       │◄───────────────┘
       │     └──────────────────┘
       │
       │     ┌──────────────────────┐
       │     │ KnowledgeConnection  │
       │     ├──────────────────────┤
       │     │ id (PK)              │
       │     │ fromId (FK) ─────────┼─► Knowledge.id
       │     │ toId (FK) ───────────┼─► Knowledge.id
       │     │ relation             │
       │     │ weight               │
       │     │ createdAt            │
       │     └──────────────────────┘
```

### 3.2 Prisma Schema

```prisma
// User 用户
model User {
  id            String     @id @default(cuid())
  email         String     @unique
  name          String?
  image         String?
  passwordHash  String?    // 邮箱注册用户
  emailVerified DateTime?
  accounts      Account[]
  sessions      Session[]
  knowledge     Knowledge[]
  tags          Tag[]
  apiConfigs    ApiConfig[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

// ApiConfig 用户的多供应商 API 配置
model ApiConfig {
  id        String   @id @default(cuid())
  userId    String
  provider  String   // openai | anthropic | qwen | deepseek | zhipu | asr
  apiKey    String   // AES-256-GCM 加密存储
  model     String   // 默认模型名
  isActive  Boolean  @default(false)  // 是否为当前默认
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, provider])
}

// Knowledge 知识条目
model Knowledge {
  id          String   @id @default(cuid())
  userId      String
  title       String
  sourceType  String   // url | pdf | text | markdown | douyin | xiaohongshu
  sourceUrl   String?
  rawContent  String   @db.Text  // 原始内容（视频为 ASR 转写文本）
  summary     String   @db.Text
  outline     Json?
  mindMap     Json?
  keyPoints   Json?
  entities    Json?
  status      String   @default("pending") // pending|processing|completed|failed
  wordCount   Int      @default(0)
  readingTime Int      @default(0)
  distillTime Int      @default(0)
  tokensUsed  Int      @default(0)
  errorMessage String? @db.Text
  // 媒体元数据（视频/音频蒸馏时填充）
  mediaMeta   Json?    // {duration, platform, author, publishDate, videoUrl, audioUrl}
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags        KnowledgeTag[]
  connectionsFrom KnowledgeConnection[] @relation("from")
  connectionsTo   KnowledgeConnection[] @relation("to")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([userId, status])
  @@index([userId, sourceType])
}

// Tag 标签
model Tag {
  id        String         @id @default(cuid())
  userId    String
  name      String
  color     String         @default("#6366f1")
  knowledge KnowledgeTag[]
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime       @default(now())

  @@unique([userId, name])
  @@index([userId])
}

// KnowledgeTag 知识-标签多对多
model KnowledgeTag {
  knowledgeId String
  tagId       String
  knowledge   Knowledge @relation(fields: [knowledgeId], references: [id], onDelete: Cascade)
  tag         Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([knowledgeId, tagId])
}

// KnowledgeConnection 知识图谱边
model KnowledgeConnection {
  id        String   @id @default(cuid())
  fromId    String
  toId      String
  relation  String   // related | similar | references | extends
  weight    Float    @default(0.5)
  from      Knowledge @relation("from", fields: [fromId], references: [id], onDelete: Cascade)
  to        Knowledge @relation("to", fields: [toId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([fromId, toId, relation])
  @@index([fromId])
  @@index([toId])
}
```

### 3.3 全文搜索策略

**方案 A（首选）**：PostgreSQL `tsvector` + GIN 索引
```sql
-- 添加 tsvector 列
ALTER TABLE "Knowledge" ADD COLUMN search_vector tsvector;
-- 更新触发器
CREATE INDEX knowledge_search_idx ON "Knowledge" USING GIN(search_vector);
```

**方案 B（降级）**：`ILIKE` 模糊查询
```sql
SELECT * FROM "Knowledge"
WHERE "userId" = $1
AND (title ILIKE '%$2%' OR summary ILIKE '%$2%' OR "rawContent" ILIKE '%$2%');
```

MVP 阶段优先使用方案 B（简单可靠），后续升级到方案 A。

---

## 四、Python 媒体处理服务设计

### 4.0 服务概述

Python 媒体处理服务（`services/media-processor`）是独立的 FastAPI 微服务，负责所有需要 Python 生态的媒体处理能力：

| 能力 | 端点 | 依赖库 |
|------|------|--------|
| 抖音视频下载 | `POST /media/douyin` | yt-dlp |
| 小红书内容提取 | `POST /media/xiaohongshu` | requests + BeautifulSoup |
| 音频分离 | 内部调用 | ffmpeg-python |
| 语音识别（ASR） | `POST /media/asr` | openai-whisper / 云端 ASR SDK |
| PDF 解析 | `POST /pdf/extract` | opendataloader-pdf |
| 健康检查 | `GET /health` | - |

**通信协议**：Next.js 主服务通过 HTTP 调用 Python 服务，使用内部网络（不对外暴露）。

**Python 代码规范**（遵循用户规则）：
- 所有代码符合 PEP 8 规范（使用 ruff + black 强制）
- 所有代码包含注释
- 所有代码包含 docstring
- 所有 Python 命令以 `py` 开头（如 `py -m pytest`、`py -m uvicorn`）

### 4.0.1 抖音视频下载流程

```python
# services/media-processor/app/core/downloader.py
"""抖音视频下载器模块。

使用 yt-dlp 库下载抖音视频，并提取元数据。
"""

from yt_dlp import YoutubeDL
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def download_douyin_video(url: str, output_dir: Path, cookie: str | None = None) -> dict:
    """下载抖音视频并返回文件路径与元数据。

    Args:
        url: 抖音视频分享链接
        output_dir: 输出目录
        cookie: 可选的 Cookie 字符串（用于反爬）

    Returns:
        包含 file_path、title、author、duration 的字典

    Raises:
        DownloadError: 下载失败时抛出
    """
    # yt-dlp 配置
    ydl_opts = {
        "outtmpl": str(output_dir / "%(id)s.%(ext)s"),
        "format": "best",
        "noplaylist": True,
        "quiet": True,
    }
    if cookie:
        ydl_opts["cookiefile"] = cookie  # 或使用 http_headers

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return {
            "file_path": ydl.prepare_filename(info),
            "title": info.get("title", ""),
            "author": info.get("uploader", ""),
            "duration": info.get("duration", 0),
        }
```

### 4.0.2 音频分离流程

```python
# services/media-processor/app/core/audio_extractor.py
"""音频分离模块。

使用 ffmpeg 从视频中分离音频轨道。
"""

import ffmpeg
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def extract_audio(video_path: Path, output_path: Path) -> Path:
    """从视频文件中分离音频。

    Args:
        video_path: 视频文件路径
        output_path: 输出音频文件路径（.mp3 或 .wav）

    Returns:
        输出音频文件路径

    Raises:
        ffmpeg.Error: ffmpeg 处理失败
    """
    # 使用 ffmpeg 提取音频，转为 16kHz 单声道 wav（ASR 友好格式）
    (
        ffmpeg
        .input(str(video_path))
        .output(
            str(output_path),
            ac=1,           # 单声道
            ar=16000,       # 16kHz 采样率
            acodec="pcm_s16le",  # 16-bit PCM
        )
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path
```

### 4.0.3 ASR 语音识别

```python
# services/media-processor/app/core/asr_provider.py
"""ASR 语音识别供应商适配模块。

支持多供应商：Whisper 本地、通义听悟、讯飞、OpenAI Whisper API。
"""

from abc import ABC, abstractmethod
from pathlib import Path


class ASRProvider(ABC):
    """ASR 供应商抽象基类。"""

    @abstractmethod
    def transcribe(self, audio_path: Path) -> str:
        """将音频转写为文本。

        Args:
            audio_path: 音频文件路径

        Returns:
            转写文本
        """
        ...


class WhisperLocalProvider(ASRProvider):
    """本地 Whisper 模型供应商（兜底方案）。"""

    def __init__(self, model_size: str = "base"):
        """初始化 Whisper 模型。

        Args:
            model_size: 模型大小（tiny/base/small/medium/large）
        """
        import whisper
        self.model = whisper.load_model(model_size)

    def transcribe(self, audio_path: Path) -> str:
        """使用本地 Whisper 转写音频。"""
        result = self.model.transcribe(str(audio_path), language="zh")
        return result["text"]


class CloudASRProvider(ASRProvider):
    """云端 ASR 供应商（通义听悟/讯飞等）。"""

    def __init__(self, provider: str, api_key: str):
        """初始化云端 ASR 客户端。

        Args:
            provider: 供应商名称
            api_key: API Key
        """
        self.provider = provider
        self.api_key = api_key

    def transcribe(self, audio_path: Path) -> str:
        """调用云端 ASR API 转写音频。"""
        # 根据供应商调用对应 SDK
        ...
```

### 4.0.4 PDF 解析（opendataloader-pdf）

```python
# services/media-processor/app/core/pdf_extractor.py
"""PDF 解析模块。

使用 opendataloader-pdf 引擎解析 PDF，支持复杂表格、OCR、公式。
"""

import opendataloader_pdf
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def extract_pdf_text(pdf_path: Path, output_dir: Path, use_hybrid: bool = False) -> str:
    """使用 opendataloader-pdf 提取 PDF 文本。

    Args:
        pdf_path: PDF 文件路径
        output_dir: 输出目录
        use_hybrid: 是否启用 Hybrid 模式（用于扫描件/复杂表格）

    Returns:
        提取的 Markdown 文本

    Raises:
        Exception: PDF 解析失败
    """
    # 调用 opendataloader-pdf 转换
    opendataloader_pdf.convert(
        input_path=[str(pdf_path)],
        output_dir=str(output_dir),
        format="markdown",
        **({"hybrid": "docling-fast"} if use_hybrid else {}),
    )

    # 读取生成的 Markdown 文件
    md_file = output_dir / f"{pdf_path.stem}.md"
    return md_file.read_text(encoding="utf-8")
```

### 4.0.5 小红书内容提取

```python
# services/media-processor/app/core/xhs_extractor.py
"""小红书笔记内容提取模块。

提取图文笔记的标题、正文、图片，或视频笔记的视频链接。
"""

import requests
from bs4 import BeautifulSoup
import re
import logging

logger = logging.getLogger(__name__)


def extract_xiaohongshu_note(url: str, cookie: str | None = None) -> dict:
    """提取小红书笔记内容。

    Args:
        url: 小红书笔记链接
        cookie: 可选 Cookie（用于反爬）

    Returns:
        包含 type（image/video）、title、content、video_url 的字典

    Raises:
        Exception: 提取失败
    """
    headers = {
        "User-Agent": "Mozilla/5.0 ...",
    }
    if cookie:
        headers["Cookie"] = cookie

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # 提取标题
    title = soup.find("title").text if soup.find("title") else ""

    # 提取正文（小红书正文在特定 class 中）
    content_el = soup.find(class_=re.compile("content|desc"))
    content = content_el.get_text(strip=True) if content_el else ""

    # 判断是图文还是视频
    video_el = soup.find("video")
    if video_el:
        video_url = video_el.get("src", "")
        return {"type": "video", "title": title, "content": content, "video_url": video_url}

    return {"type": "image", "title": title, "content": content, "video_url": None}
```

### 4.0.6 FastAPI 路由示例

```python
# services/media-processor/app/api/douyin.py
"""抖音视频处理 API 路由。"""

from fastapi import APIRouter, HTTPException
from pathlib import Path
from ..schemas.media import DouyinRequest, DouyinResponse
from ..core.downloader import download_douyin_video
from ..core.audio_extractor import extract_audio
from ..core.asr_provider import get_asr_provider
from ..config import settings
from ..utils.cleanup import cleanup_temp_files

router = APIRouter(prefix="/media", tags=["douyin"])


@router.post("/douyin", response_model=DouyinResponse)
async def process_douyin_video(request: DouyinRequest) -> DouyinResponse:
    """处理抖音视频：下载 → 分离音频 → ASR 识别。

    Args:
        request: 包含 url 和可选 cookie 的请求体

    Returns:
        包含转写文本和元数据的响应

    Raises:
        HTTPException: 处理失败时返回 400/500
    """
    temp_dir = Path(settings.TEMP_DIR) / f"douyin_{request.task_id}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. 下载视频
        video_info = download_douyin_video(
            url=request.url,
            output_dir=temp_dir,
            cookie=request.cookie,
        )

        # 2. 分离音频
        audio_path = temp_dir / "audio.wav"
        extract_audio(Path(video_info["file_path"]), audio_path)

        # 3. ASR 识别
        asr_provider = get_asr_provider()
        transcript = asr_provider.transcribe(audio_path)

        return DouyinResponse(
            transcript=transcript,
            title=video_info["title"],
            author=video_info["author"],
            duration=video_info["duration"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        cleanup_temp_files(temp_dir)
```

### 4.0.7 Next.js 主服务调用 Python 服务的客户端

```typescript
// apps/web/src/lib/media/client.ts
/**
 * Python 媒体处理服务客户端
 * 封装所有对 Python 服务的 HTTP 调用
 */

import { MEDIA_SERVICE_URL } from '@/lib/config';

interface DouyinProcessResult {
  transcript: string;
  title: string;
  author: string;
  duration: number;
}

interface PdfExtractResult {
  markdown: string;
  pageCount: number;
}

/**
 * 处理抖音视频：下载 → 分离音频 → ASR
 */
export async function processDouyinVideo(
  url: string,
  cookie?: string
): Promise<DouyinProcessResult> {
  const response = await fetch(`${MEDIA_SERVICE_URL}/media/douyin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, cookie, task_id: crypto.randomUUID() }),
  });
  if (!response.ok) {
    throw new Error(`抖音视频处理失败: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 处理小红书笔记
 */
export async function processXiaohongshuNote(
  url: string,
  cookie?: string
): Promise<XiaohongshuProcessResult> {
  const response = await fetch(`${MEDIA_SERVICE_URL}/media/xiaohongshu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, cookie, task_id: crypto.randomUUID() }),
  });
  if (!response.ok) {
    throw new Error(`小红书笔记处理失败: ${response.statusText}`);
  }
  return response.json();
}

/**
 * PDF 解析（使用 opendataloader-pdf）
 */
export async function extractPdf(
  filePath: string,
  useHybrid: boolean = false
): Promise<PdfExtractResult> {
  const formData = new FormData();
  formData.append('file', filePath);
  formData.append('use_hybrid', String(useHybrid));

  const response = await fetch(`${MEDIA_SERVICE_URL}/pdf/extract`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`PDF 解析失败: ${response.statusText}`);
  }
  return response.json();
}
```

### 4.0.8 蒸馏服务集成媒体处理

在 `DistillService` 中根据 `sourceType` 路由到不同的提取器：

```typescript
// apps/web/src/services/distill.service.ts（节选）
async function extractContent(input: DistillInput): Promise<string> {
  switch (input.sourceType) {
    case 'url':
      return await extractFromUrl(input.sourceUrl!);
    case 'text':
    case 'markdown':
      return input.content!;
    case 'pdf':
      // 调用 Python 服务（opendataloader-pdf）
      const pdfResult = await extractPdf(input.filePath!, input.useHybrid);
      return pdfResult.markdown;
    case 'douyin':
      // 调用 Python 服务：下载 → 分离音频 → ASR
      const douyinResult = await processDouyinVideo(input.sourceUrl!, input.cookie);
      // 保存媒体元数据
      await updateMediaMeta(input.knowledgeId, {
        platform: 'douyin',
        author: douyinResult.author,
        duration: douyinResult.duration,
      });
      return douyinResult.transcript;
    case 'xiaohongshu':
      // 调用 Python 服务
      const xhsResult = await processXiaohongshuNote(input.sourceUrl!, input.cookie);
      if (xhsResult.type === 'video') {
        // 视频笔记：走视频处理流程
        const videoResult = await processDouyinVideo(xhsResult.video_url);
        return `${xhsResult.title}\n\n${xhsResult.content}\n\n${videoResult.transcript}`;
      }
      // 图文笔记：直接使用文本
      return `${xhsResult.title}\n\n${xhsResult.content}`;
    default:
      throw new Error(`不支持的来源类型: ${input.sourceType}`);
  }
}
```

---

## 五、核心模块设计

### 5.1 AI 供应商适配器

**统一接口**（`apps/web/src/lib/ai/provider.ts`）：

```typescript
/**
 * AI 供应商统一接口
 * 所有供应商适配器需实现此接口
 */
interface AIProvider {
  /** 供应商名称 */
  readonly name: string;

  /**
   * 同步聊天
   * @param messages 消息列表
   * @param options 聊天选项（温度、最大 token 等）
   * @returns 聊天响应
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * 流式聊天
   * @param messages 消息列表
   * @param options 聊天选项
   * @returns 异步迭代器，逐块返回内容
   */
  streamChat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<ChatChunk>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: 'text' | 'json';
}

interface ChatResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

interface ChatChunk {
  delta: string;
  done: boolean;
}
```

**工厂模式**（`apps/web/src/lib/ai/factory.ts`）：

```typescript
class AIProviderFactory {
  private static providers = new Map<string, () => AIProvider>();

  static register(name: string, factory: () => AIProvider): void {
    this.providers.set(name, factory);
  }

  static create(provider: string, config: { apiKey: string; model: string }): AIProvider {
    const factory = this.providers.get(provider);
    if (!factory) throw new Error(`Unknown provider: ${provider}`);
    return factory(config);
  }
}

// 注册所有供应商
AIProviderFactory.register('openai', (c) => new OpenAIProvider(c));
AIProviderFactory.register('anthropic', (c) => new AnthropicProvider(c));
AIProviderFactory.register('qwen', (c) => new QwenProvider(c));
AIProviderFactory.register('deepseek', (c) => new DeepSeekProvider(c));
AIProviderFactory.register('zhipu', (c) => new ZhipuProvider(c));
```

### 4.2 蒸馏服务

**蒸馏流水线**（`apps/web/src/services/distill.service.ts`）：

```
输入源
  │
  ▼
[1. 内容提取]  ──── URL: fetch + Readability
  │              ──── PDF: pdf-parse
  │              ──── Text: 直接使用
  ▼
[2. 清洗预处理] ──── 去广告/导航/页脚
  │              ──── 统一编码
  ▼
[3. 分块]       ──── 按 token 数分块（chunk size: 4000, overlap: 200）
  │              ──── 单块 ≤ 4000 tokens
  ▼
[4. AI 蒸馏]    ──── 调用 LLM API
  │              ──── JSON Mode 输出
  │              ──── 流式返回（可选）
  ▼
[5. 结构化解析] ──── 解析 JSON
  │              ──── 校验 schema
  ▼
[6. 实体抽取]   ──── 从蒸馏结果抽取实体
  │              ──── 存入 entities 字段
  ▼
[7. 图谱关联]   ──── 与已有知识匹配
  │              ──── 创建 KnowledgeConnection
  ▼
[8. 入库]       ──── 保存 Knowledge + Tags
```

**蒸馏 Prompt**（`apps/web/src/lib/ai/prompts.ts`）：

```typescript
const DISTILL_SYSTEM_PROMPT = `你是一位专业的知识蒸馏专家。你的任务是将输入的内容蒸馏为结构化的知识卡片，帮助用户快速掌握核心要点。

输出要求：
1. summary: 200 字以内的核心摘要
2. keyPoints: 3-7 个关键要点，每个不超过 50 字
3. outline: 层级大纲，最多 3 级，格式为 [{title, children: [{title, children}]}]
4. entities: 核心实体列表，格式为 [{name, type}]，type ∈ [person, concept, organization, technology, location, event]
5. suggestedTags: 3-5 个推荐标签（中文）

严格输出 JSON 格式，不要包含任何额外说明。`;

const DISTILL_USER_PROMPT_TEMPLATE = `请蒸馏以下内容：

标题：{title}
内容：
{content}

输出 JSON 格式：
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "outline": [{"title": "...", "children": [...]}],
  "entities": [{"name": "...", "type": "..."}],
  "suggestedTags": ["...", "..."]
}`;
```

### 4.3 知识图谱构建

**关联算法**（`apps/web/src/services/graph.service.ts`）：

```typescript
/**
 * 计算两个知识条目之间的关联强度
 * @param newKnowledge 新知识
 * @param existingKnowledge 已有知识
 * @returns 关联强度 0-1
 */
function calculateRelationWeight(
  newKnowledge: Knowledge,
  existingKnowledge: Knowledge
): number {
  // 1. 实体重叠率（权重 0.6）
  const newEntities = new Set(newKnowledge.entities.map(e => e.name));
  const existingEntities = new Set(existingKnowledge.entities.map(e => e.name));
  const intersection = [...newEntities].filter(e => existingEntities.has(e));
  const union = new Set([...newEntities, ...existingEntities]);
  const entityScore = union.size > 0 ? intersection.length / union.size : 0;

  // 2. 标签相似度（权重 0.4）
  const newTags = new Set(newKnowledge.tags.map(t => t.name));
  const existingTags = new Set(existingKnowledge.tags.map(t => t.name));
  const tagIntersection = [...newTags].filter(t => existingTags.has(t));
  const tagScore = newTags.size + existingTags.size > 0
    ? (2 * tagIntersection.length) / (newTags.size + existingTags.size)
    : 0;

  return entityScore * 0.6 + tagScore * 0.4;
}

/**
 * 为新知识创建关联
 * 仅创建 weight > 0.3 的关联
 */
async function createConnections(newKnowledgeId: string, userId: string): Promise<void> {
  const newKnowledge = await getKnowledgeWithRelations(newKnowledgeId);
  const existingKnowledge = await getAllUserKnowledge(userId);

  for (const existing of existingKnowledge) {
    if (existing.id === newKnowledgeId) continue;
    const weight = calculateRelationWeight(newKnowledge, existing);
    if (weight > 0.3) {
      const relation = weight > 0.6 ? 'similar' : 'related';
      await prisma.knowledgeConnection.create({
        data: {
          fromId: newKnowledgeId,
          toId: existing.id,
          relation,
          weight,
        },
      });
    }
  }
}
```

### 4.4 浏览器插件设计

**Manifest V3 配置**：

```json
{
  "manifest_version": 3,
  "name": "Distill - AI 知识蒸馏",
  "version": "1.0.0",
  "description": "一键蒸馏网页内容，自动构建个人知识图谱",
  "permissions": [
    "sidePanel",
    "activeTab",
    "storage",
    "contextMenus",
    "scripting"
  ],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_title": "打开蒸馏面板"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**核心交互流程**：

```
用户点击插件图标
       │
       ▼
[Background] 打开 Side Panel
       │
       ▼
[Content Script] 提取当前页面内容
  · 使用 Mozilla Readability 提取正文
  · 提取标题、作者、发布时间
       │
       ▼
[Side Panel] 显示预览
  · 标题、字数、预计阅读时间
  · "一键蒸馏"按钮
       │
       ▼
用户点击"一键蒸馏"
       │
       ▼
[Side Panel] → [Background] → [API] /api/distill
       │
       ▼
[API] 执行蒸馏流水线
  · 返回蒸馏任务 ID
       │
       ▼
[Side Panel] 轮询任务状态 / SSE 流式更新
       │
       ▼
[Side Panel] 展示蒸馏结果
  · 摘要、关键点、大纲、推荐标签
  · 用户可编辑标签
  · "保存到知识库"按钮
       │
       ▼
用户点击"保存"
       │
       ▼
[API] 保存知识 + 创建图谱关联
       │
       ▼
[Side Panel] 显示"已保存" + 查看关联知识入口
```

### 4.5 认证与安全

**认证流程**（NextAuth.js）：

```typescript
// apps/web/src/lib/auth/config.ts
import NextAuth from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
};
```

**API Key 加密**：

```typescript
// apps/web/src/lib/crypto/index.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY!; // 32 字节密钥

/**
 * 加密 API Key
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * 解密 API Key
 */
export function decrypt(encrypted: string): string {
  const data = Buffer.from(encrypted, 'base64');
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encryptedText = data.subarray(32);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encryptedText) + decipher.final('utf8');
}
```

---

## 五、API 设计

### 5.1 RESTful API 端点

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/auth/signin | 登录 | 否 |
| POST | /api/auth/signout | 登出 | 是 |
| POST | /api/distill | 创建蒸馏任务 | 是 |
| GET | /api/distill/:id | 查询蒸馏状态 | 是 |
| GET | /api/distill | 蒸馏任务列表 | 是 |
| GET | /api/knowledge | 知识列表（分页） | 是 |
| GET | /api/knowledge/:id | 知识详情 | 是 |
| PATCH | /api/knowledge/:id | 更新知识 | 是 |
| DELETE | /api/knowledge/:id | 删除知识 | 是 |
| GET | /api/search | 全文搜索 | 是 |
| GET | /api/graph | 图谱数据 | 是 |
| GET | /api/tags | 标签列表 | 是 |
| POST | /api/tags | 创建标签 | 是 |
| DELETE | /api/tags/:id | 删除标签 | 是 |
| POST | /api/upload | 上传文件 | 是 |
| GET | /api/settings/api-configs | API 配置列表 | 是 |
| POST | /api/settings/api-configs | 添加 API 配置 | 是 |
| PATCH | /api/settings/api-configs/:id | 更新配置 | 是 |
| DELETE | /api/settings/api-configs/:id | 删除配置 | 是 |

### 5.2 关键 API 请求/响应示例

**创建蒸馏任务**：

```http
POST /api/distill
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourceType": "url",
  "sourceUrl": "https://example.com/article",
  "title": "可选标题"
}
```

```json
{
  "id": "knowledge_id",
  "status": "processing",
  "message": "蒸馏任务已创建"
}
```

**查询蒸馏状态**：

```http
GET /api/distill/knowledge_id
```

```json
{
  "id": "knowledge_id",
  "status": "completed",
  "title": "文章标题",
  "summary": "...",
  "keyPoints": ["...", "..."],
  "outline": [...],
  "entities": [...],
  "suggestedTags": ["...", "..."],
  "wordCount": 3500,
  "readingTime": 12,
  "distillTime": 8
}
```

**图谱数据**：

```http
GET /api/graph?tag=AI&timeRange=month
```

```json
{
  "nodes": [
    { "id": "k1", "title": "知识1", "degree": 5, "tags": ["AI"] },
    { "id": "k2", "title": "知识2", "degree": 3, "tags": ["AI"] }
  ],
  "edges": [
    { "from": "k1", "to": "k2", "relation": "similar", "weight": 0.75 }
  ]
}
```

---

## 六、UI/UX 设计

### 6.1 设计原则

参考 [21st.dev](https://21st.dev/community/components) 组件库风格：
- **简洁现代**：大量留白，清晰的视觉层级
- **微交互**：按钮悬停、加载动画、过渡效果
- **一致性**：统一的颜色、字体、间距系统
- **响应式**：桌面优先，移动端适配

### 6.2 色彩系统

```typescript
// tailwind.config.ts
const colors = {
  primary: {
    50: '#eef2ff',   // 最浅
    500: '#6366f1',  // 主色（Indigo）
    600: '#4f46e5',
    700: '#4338ca',
    900: '#312e81',  // 最深
  },
  // 语义色
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  // 中性色
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',
};
```

### 6.3 关键页面布局

**工作台布局**：

```
┌──────────────────────────────────────────────────────────┐
│  [Logo] Distill          [搜索框]              [用户头像] │  ← 顶栏
├────────┬─────────────────────────────────────────────────┤
│        │                                                 │
│ 🏠 首页 │                                                 │
│ 📚 知识 │              主内容区                            │
│ 🔍 搜索 │                                                 │
│ 🕸️ 图谱 │                                                 │
│ ⚙️ 设置 │                                                 │
│        │                                                 │
└────────┴─────────────────────────────────────────────────┘
```

**插件 Side Panel**：

```
┌─────────────────────────────┐
│  [Logo] Distill        [×]  │
├─────────────────────────────┤
│                             │
│  📄 当前页面                 │
│  标题：xxx                   │
│  字数：3500 | 阅读：12 分钟  │
│                             │
│  ┌─────────────────────┐    │
│  │  ⚡ 一键蒸馏         │    │
│  └─────────────────────┘    │
│                             │
│  ── 蒸馏结果 ──             │
│                             │
│  📝 摘要                    │
│  xxx                        │
│                             │
│  🎯 关键要点                │
│  • 要点 1                   │
│  • 要点 2                   │
│                             │
│  🏷️ 标签                   │
│  [AI] [深度学习] [+]        │
│                             │
│  ┌─────────────────────┐    │
│  │  💾 保存到知识库     │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

---

## 七、错误处理与边界情况

### 7.1 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| LLM API 调用失败 | 自动重试 3 次，指数退避，仍失败则标记任务 failed |
| LLM 输出非 JSON | 尝试从文本中提取 JSON，失败则降级为纯文本摘要 |
| PDF 解析失败 | 提示"PDF 解析失败，可能是扫描件" |
| 网页内容提取失败 | 提示"无法提取页面内容，请尝试手动粘贴" |
| API Key 无效 | 提示"API Key 无效，请检查设置" |
| 数据库连接失败 | 返回 500，记录日志，提示"服务暂时不可用" |
| 用户未配置 API Key | 引导用户到设置页配置 |

### 7.2 限流策略

- 蒸馏任务：每用户每小时 20 次
- 文件上传：每用户每天 100MB
- API 请求：每用户每分钟 60 次

---

## 八、部署架构

### 8.1 开发环境

```
本地开发
├── Next.js Dev Server (localhost:3000)
├── Chrome Extension (Chrome 开发者模式加载)
├── PostgreSQL (本地或 Docker)
└── 环境变量 (.env.local)
```

### 8.2 生产环境

```
┌─────────────────────────────────────────┐
│           Vercel / 自建服务器            │
│  ─────────────────────────────────────  │
│  · Next.js 应用（Web + API）            │
│  · 静态资源 CDN                         │
│  · 环境变量（加密密钥、OAuth 凭证）      │
├─────────────────────────────────────────┤
│           PostgreSQL 数据库              │
│  ─────────────────────────────────────  │
│  · Supabase / Neon / 自建               │
└─────────────────────────────────────────┘
```

### 8.3 环境变量

```bash
# .env.example

# 数据库
DATABASE_URL="postgresql://user:pass@localhost:5432/distill"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# GitHub OAuth
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# 邮件（可选）
EMAIL_SERVER=""
EMAIL_FROM=""

# 加密密钥（32 字节，base64）
ENCRYPTION_KEY=""

# 文件存储路径
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="20971520"  # 20MB
```
