# Distill · AI 知识蒸馏站

> 2026 AI TRAE 创造力大赛参赛作品 · 浏览器插件 + Web 端联动的个人知识管理系统
>
> 一键导入任意格式信息源（网页 / PDF / 抖音 / 小红书 / 文本），AI 蒸馏核心要点，自动建立知识图谱关联，实现"输入即内化"。

---

## ✨ 核心功能

| 功能模块 | 说明 |
|---------|------|
| **一键蒸馏** | 浏览器插件抓取网页 → AI 生成 200 字摘要 + 3-7 个关键要点 + 推荐标签 |
| **多源输入** | 网页 URL / PDF 文件（最大 50MB，浏览器直传媒体服务）/ 纯文本 / 抖音视频（无需 Cookie）/ 小红书笔记 |
| **知识库** | 全文检索、标签筛选、卡片/列表双视图、详情编辑 |
| **知识图谱** | 可视化网络呈现知识点关联，支持拖拽、缩放、节点筛选 |
| **多 AI 供应商** | OpenAI / Anthropic / 通义千问 / DeepSeek / 智谱 AI / Minimax，用户可自由切换 |
| **ASR 语音识别** | 用户自带 Key 支持硅基流动（推荐，国内可访问）/ Groq / OpenAI Whisper，用于抖音/小红书视频蒸馏 |
| **浏览器插件** | Chrome/Edge 一键蒸馏当前网页，侧边栏实时查看进度与结果 |

---

## 🏗️ 技术栈

### Web 应用（`apps/web`）
- **框架**：Next.js 16 (App Router) + React 19 + TypeScript 5
- **样式**：Tailwind CSS 4 + Radix UI + shadcn/ui (new-york)
- **ORM**：Prisma 7 + PostgreSQL 15
- **认证**：NextAuth v5 (Credentials + GitHub OAuth)
- **AI**：自研多供应商适配层（OpenAI / Anthropic / Qwen / DeepSeek / Zhipu）
- **流式**：Server-Sent Events (SSE) 实时推送蒸馏进度

### 浏览器插件（`apps/extension`）
- **框架**：React 19 + Vite 5 + @crxjs/vite-plugin
- **API**：Manifest V3 + Side Panel API + Content Scripts
- **解析**：@mozilla/readability 提取网页正文

### 媒体处理服务（`services/media-processor`）
- **框架**：FastAPI + Uvicorn
- **视频下载**：yt-dlp（抖音 / 小红书多平台）
- **音频处理**：ffmpeg-python（需系统 ffmpeg）
- **ASR**：硅基流动 SenseVoiceSmall（推荐）/ Groq Whisper / OpenAI Whisper（用户自带 Key，通过 header 传递）
- **PDF**：opendataloader-pdf（复杂表格 / OCR / 公式）

### 共享包（`packages/shared`）
- TypeScript 类型定义与常量（API 契约、蒸馏任务、知识模型）

---

## 📦 项目结构

```
.
├── apps/
│   ├── web/                  # Next.js 主应用
│   │   ├── src/
│   │   │   ├── app/          # App Router 页面与 API 路由
│   │   │   ├── components/   # UI 组件（shadcn/ui + 业务组件）
│   │   │   ├── lib/          # AI 适配层、认证、安全、工具
│   │   │   └── services/     # 业务服务层（distill/knowledge/graph/search/tag）
│   │   ├── prisma/schema.prisma
│   │   ├── Dockerfile
│   │   └── docker-entrypoint.sh
│   └── extension/            # Chrome/Edge 浏览器插件
│       ├── src/
│       │   ├── background/   # Service Worker
│       │   ├── content/      # 内容脚本
│       │   ├── sidepanel/    # 侧边栏 UI
│       │   └── lib/          # API、认证、存储
│       └── manifest.json
├── packages/
│   └── shared/               # 共享类型与常量
├── services/
│   └── media-processor/      # Python FastAPI 媒体处理服务
└── docker-compose.yml        # 一键启动 Web + 媒体服务 + PostgreSQL
```

---

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 克隆仓库
git clone <repo-url> && cd distill

# 2. 复制环境变量并修改
cp .env.example .env
# 编辑 .env：修改 POSTGRES_PASSWORD、NEXTAUTH_SECRET

# 3. 一键启动
docker-compose up -d

# 4. 查看日志
docker-compose logs -f web
```

启动完成后访问 [http://localhost:3000](http://localhost:3000)。

**服务端口**：
- Web 应用：`3000`
- 媒体处理服务：`8001`
- PostgreSQL：`5432`

### 方式二：本地开发

#### 前置依赖
- Node.js ≥ 20
- pnpm ≥ 9
- Python ≥ 3.10
- PostgreSQL ≥ 14
- ffmpeg（媒体处理）
- Java 11+（PDF OCR，可选）

#### 步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env：填写 DATABASE_URL、NEXTAUTH_SECRET 等

# 3. 初始化数据库
cd apps/web
pnpm db:generate
pnpm db:push
cd ../..

# 4. 启动 Web 应用（终端 1）
pnpm --filter web dev

# 5. 启动媒体处理服务（终端 2）
cd services/media-processor
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

---

## 🧩 浏览器插件安装

### 开发模式加载

```bash
# 1. 构建插件
pnpm --filter @distill/extension build

# 2. 打开 Chrome/Edge 扩展管理页
#    Chrome:  chrome://extensions
#    Edge:    edge://extensions

# 3. 开启「开发者模式」

# 4. 点击「加载已解压的扩展程序」
#    选择 apps/extension/dist 目录

# 5. 在任意网页点击工具栏的 Distill 图标
#    侧边栏打开后，使用 Web 端注册的账号登录即可
```

### 使用流程

1. 在 Web 端注册账号并登录
2. 在「设置 → AI 供应商配置」中添加至少一个 LLM API Key（支持 OpenAI / Anthropic / Qwen / DeepSeek / 智谱 / Minimax）
3. 如需蒸馏抖音/小红书视频，在「设置 → ASR 语音识别配置」中添加 ASR API Key（推荐硅基流动，国内可访问，免费额度）
4. 打开任意网页，点击浏览器工具栏的 Distill 图标
5. 侧边栏点击「一键蒸馏」，等待 AI 处理完成
6. 在 Web 端「知识库」查看蒸馏结果，在「图谱」查看关联

---

## ⚙️ 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://distill:distill_dev_2026@localhost:5432/distill` |
| `POSTGRES_PASSWORD` | Docker Compose 数据库密码 | `distill_dev_2026` |
| `NEXTAUTH_URL` | 应用对外访问 URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥（生产必改） | - |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth 凭证（可选） | - |
| `MEDIA_SERVICE_URL` | 媒体处理服务地址（服务端调用） | `http://localhost:8001` |
| `NEXT_PUBLIC_MEDIA_SERVICE_URL` | 媒体处理服务地址（浏览器直传大文件用，部署在 Vercel 时必填） | 同 `MEDIA_SERVICE_URL` |

> AI 供应商 API Key 与 ASR API Key 均在应用内「设置」页面管理，使用 AES-256-GCM 加密存储于数据库。
>
> - **LLM 配置**：设置 → AI 供应商配置（OpenAI / Anthropic / Qwen / DeepSeek / 智谱 / Minimax）
> - **ASR 配置**：设置 → ASR 语音识别配置（硅基流动 / Groq / OpenAI Whisper），用于抖音/小红书视频蒸馏

---

## 📜 常用脚本

### Web 应用

```bash
pnpm --filter web dev          # 开发模式
pnpm --filter web build        # 生产构建
pnpm --filter web start        # 启动生产服务
pnpm --filter web typecheck    # 类型检查
pnpm --filter web db:generate  # 生成 Prisma Client
pnpm --filter web db:push      # 同步 schema 到数据库
pnpm --filter web db:studio    # 打开 Prisma Studio
```

### 浏览器插件

```bash
pnpm --filter @distill/extension dev      # 开发模式（HMR）
pnpm --filter @distill/extension build    # 构建到 dist/
pnpm --filter @distill/extension typecheck
```

### 媒体处理服务

```bash
cd services/media-processor
uvicorn app.main:app --reload --port 8001    # 开发模式
```

### 演示数据

```bash
cd apps/web
node scripts/seed-demo.mjs    # 填充演示账号、知识、标签、关联
```

演示账号：`demo@distill.app` / `demo123456`，包含 8 条知识、8 个标签、11 条关联。

---

## 🔒 安全特性

- **认证**：NextAuth v5 + Credentials（bcrypt 加密）+ GitHub OAuth
- **授权**：所有 API 路由通过 `requireAuth` 中间件校验，数据按 `userId` 隔离
- **限流**：注册 3/min、扩展登录 5/min、蒸馏 10/min、上传 5/min（滑动窗口）
- **加密**：AI API Key 与 ASR API Key 使用 AES-256-GCM 加密存储
- **ASR 凭证传递**：用户 ASR Key 通过 HTTP header 传递给媒体服务，不在服务端持久化明文
- **XSS 防护**：搜索结果高亮前先 `escapeHtml`，再 `dangerouslySetInnerHTML`
- **SQL 注入**：Prisma 参数化查询

---

## 📐 架构亮点

- **Monorepo**：pnpm workspace + turbo，统一依赖与构建
- **代码分割**：知识图谱（@xyflow/react + d3-force）通过 `next/dynamic` 懒加载
- **流式蒸馏**：Server-Sent Events 实时推送任务状态，替代轮询
- **多 AI 供应商**：工厂模式 + 统一接口，运行时切换（含 Minimax）
- **用户自带 Key**：LLM 与 ASR 配置分离，用户可在设置页管理各自的 API Key
- **Docker 化**：多阶段构建 + standalone 输出，镜像体积优化
- **数据库索引**：针对 `userId`、`userId+status`、`userId+createdAt` 等高频查询路径建立复合索引

---

## 📝 License

MIT © 2026 AI TRAE 创造力大赛参赛作品
