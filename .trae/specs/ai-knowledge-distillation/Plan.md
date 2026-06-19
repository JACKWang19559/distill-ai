# Distill - AI 知识蒸馏站 实施计划文档（Plan）

> **版本**：v1.0 (MVP)
> **创建日期**：2026-06-17
> **关联文档**：[PRD.md](./PRD.md) | [Design.md](./Design.md)
> **实施策略**：分 7 个阶段渐进交付，每阶段产出可验证的功能

---

## 一、实施总览

### 1.1 阶段划分

| 阶段 | 名称 | 核心交付 | 验证标准 |
|------|------|----------|----------|
| 1 | 项目脚手架与基础设施 | Monorepo + 数据库 + 认证 + Python 服务脚手架 | Web 端可登录，Python 服务可启动 |
| 2 | AI 供应商适配器 + 蒸馏核心 | 文本蒸馏链路 | 粘贴文本 5 秒内返回结构化结果 |
| 3 | 知识库管理 + 搜索 | 知识 CRUD + 全文搜索 | 可创建、查看、搜索、删除知识 |
| 4 | 浏览器插件 | 网页一键蒸馏 | 任意网页 10 秒内完成蒸馏入库 |
| 5 | 知识图谱 | 图谱可视化 | 蒸馏 5+ 篇后图谱显示关联 |
| 6 | PDF + 抖音/小红书媒体蒸馏 | PDF(opendataloader-pdf) + 抖音/小红书视频蒸馏 | 50 页 PDF 30 秒，抖音短视频 60 秒 |
| 7 | 打磨与部署 | 生产可用 | 完整用户旅程跑通 |

### 1.2 依赖关系

```
阶段 1 (基础设施 + Python 服务脚手架)
    │
    ├──► 阶段 2 (蒸馏核心) ──► 阶段 4 (插件)
    │         │
    │         └──► 阶段 5 (图谱)
    │
    └──► 阶段 3 (知识库)
              │
              └──► 阶段 6 (PDF + 抖音/小红书媒体蒸馏)
                        │
                        └──► 阶段 7 (部署)
```

---

## 二、阶段 1：项目脚手架与基础设施

### 2.1 目标
搭建 Monorepo 结构，配置开发环境，跑通数据库与认证。

### 2.2 任务清单

#### 任务 1.1：初始化 Monorepo
- [ ] 创建 `package.json`（根配置）
- [ ] 创建 `pnpm-workspace.yaml`
- [ ] 创建 `turbo.json`
- [ ] 创建 `.gitignore`
- [ ] 创建 `.env.example`
- [ ] 创建 `README.md`

**关键文件内容**：

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

#### 任务 1.2：创建 Web 应用（Next.js）
- [ ] 使用 `create-next-app` 初始化 `apps/web`
- [ ] 配置 TypeScript（`tsconfig.json`）
- [ ] 配置 Tailwind CSS（`tailwind.config.ts`）
- [ ] 初始化 shadcn/ui（参考 21st.dev 风格）
- [ ] 配置路径别名 `@/*`
- [ ] 创建基础布局组件（`RootLayout`）

#### 任务 1.3：创建共享包
- [ ] 创建 `packages/shared`
- [ ] 定义共享类型（`types/knowledge.ts`, `types/distill.ts`, `types/api.ts`）
- [ ] 定义共享常量（`constants/index.ts`）

#### 任务 1.4：配置数据库
- [ ] 安装 Prisma（`pnpm add prisma @prisma/client`）
- [ ] 创建 `apps/web/prisma/schema.prisma`（完整 Schema 见 Design.md）
- [ ] 运行 `prisma migrate dev --name init`
- [ ] 创建 Prisma 客户端单例（`apps/web/src/lib/db/index.ts`）

```typescript
// apps/web/src/lib/db/index.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### 任务 1.5：配置认证
- [ ] 安装 NextAuth.js + Prisma Adapter
- [ ] 创建 `apps/web/src/lib/auth/config.ts`
- [ ] 创建 `/api/auth/[...nextauth]/route.ts`
- [ ] 创建登录页 `/login`
- [ ] 创建注册页 `/register`
- [ ] 创建 `SessionProvider` 包装根布局
- [ ] 创建中间件保护 `(dashboard)` 路由

#### 任务 1.6：创建工作区布局
- [ ] 创建 `(dashboard)/layout.tsx`（侧边栏 + 顶栏）
- [ ] 创建 `Sidebar` 组件（首页/知识库/搜索/图谱/设置）
- [ ] 创建 `Header` 组件（搜索框 + 用户菜单）
- [ ] 创建首页 `(dashboard)/page.tsx`（快速蒸馏入口占位）

#### 任务 1.7：初始化 Python 媒体处理服务脚手架
- [ ] 创建 `services/media-processor/` 目录结构（app/api, app/core, app/schemas, app/utils, tests）
- [ ] 创建 `requirements.txt`（fastapi, uvicorn, yt-dlp, ffmpeg-python, opendataloader-pdf, openai-whisper, beautifulsoup4, requests, python-multipart）
- [ ] 创建 `pyproject.toml`（配置 ruff + black 强制 PEP 8）
- [ ] 创建 `app/main.py`（FastAPI 入口 + CORS + 健康检查端点）
- [ ] 创建 `app/config.py`（配置管理：临时目录、ASR 供应商、Cookie）
- [ ] 验证 `py -m uvicorn app.main:app --reload` 可启动
- [ ] 验证 `GET /health` 返回 200
- [ ] 安装系统依赖：Java 11+（opendataloader-pdf 依赖）、ffmpeg

#### 任务 1.8：配置 Docker Compose 一键启动
- [ ] 创建根 `docker-compose.yml`（web + media-processor + postgres）
- [ ] 创建 `services/media-processor/Dockerfile`（基于 python:3.10-slim + Java + ffmpeg）
- [ ] 创建 `apps/web/Dockerfile`
- [ ] 验证 `docker-compose up` 可启动全部服务

### 2.3 验证
- [ ] `pnpm dev` 启动 Web 应用，访问 `localhost:3000`
- [ ] 可通过 GitHub OAuth 登录
- [ ] 登录后跳转到工作台首页
- [ ] 未登录访问工作台被重定向到登录页
- [ ] 数据库表已创建
- [ ] `py -m uvicorn app.main:app --reload` 启动 Python 媒体服务
- [ ] `GET /health` 返回 200
- [ ] `docker-compose up` 可一键启动全部服务

---

## 三、阶段 2：AI 供应商适配器 + 蒸馏核心

### 3.1 目标
跑通"文本输入 → AI 蒸馏 → 结构化输出"核心链路。

### 3.2 任务清单

#### 任务 2.1：实现 AI 供应商统一接口
- [ ] 创建 `apps/web/src/lib/ai/provider.ts`（定义 `AIProvider` 接口）
- [ ] 创建 `apps/web/src/lib/ai/types.ts`（ChatMessage, ChatOptions 等）

#### 任务 2.2：实现各供应商适配器
- [ ] 创建 `apps/web/src/lib/ai/openai.ts`（OpenAI 适配器）
- [ ] 创建 `apps/web/src/lib/ai/anthropic.ts`（Anthropic 适配器）
- [ ] 创建 `apps/web/src/lib/ai/qwen.ts`（通义千问适配器）
- [ ] 创建 `apps/web/src/lib/ai/deepseek.ts`（DeepSeek 适配器）
- [ ] 创建 `apps/web/src/lib/ai/zhipu.ts`（智谱 GLM 适配器）

**适配器实现要点**：
- 每个适配器实现 `AIProvider` 接口
- 支持 `chat` 和 `streamChat` 两种模式
- 支持 JSON Mode（OpenAI/DeepSeek 原生支持，其他通过 Prompt 引导）
- 统一错误处理 + 重试逻辑

#### 任务 2.3：实现工厂与路由
- [ ] 创建 `apps/web/src/lib/ai/factory.ts`
- [ ] 注册所有供应商
- [ ] 实现 `getActiveProvider(userId)` 函数（读取用户配置）

#### 任务 2.4：实现加密工具
- [ ] 创建 `apps/web/src/lib/crypto/index.ts`
- [ ] 实现 `encrypt(text)` 和 `decrypt(encrypted)`
- [ ] 编写单元测试

#### 任务 2.5：实现蒸馏 Prompt
- [ ] 创建 `apps/web/src/lib/ai/prompts.ts`
- [ ] 定义 `DISTILL_SYSTEM_PROMPT`
- [ ] 定义 `DISTILL_USER_PROMPT_TEMPLATE`
- [ ] 定义蒸馏结果的 Zod Schema 校验

```typescript
// 蒸馏结果 Schema
const DistillResultSchema = z.object({
  summary: z.string().max(300),
  keyPoints: z.array(z.string().max(100)).min(3).max(7),
  outline: z.array(z.object({
    title: z.string(),
    children: z.array(z.object({
      title: z.string(),
      children: z.array(z.object({
        title: z.string(),
      })).optional(),
    })).optional(),
  })).optional(),
  entities: z.array(z.object({
    name: z.string(),
    type: z.enum(['person', 'concept', 'organization', 'technology', 'location', 'event']),
  })),
  suggestedTags: z.array(z.string()).min(3).max(5),
});
```

#### 任务 2.6：实现蒸馏服务
- [ ] 创建 `apps/web/src/services/distill.service.ts`
- [ ] 实现 `createDistillTask(input)` 函数
- [ ] 实现 `processDistillTask(knowledgeId)` 函数（异步处理）
- [ ] 实现 `getDistillStatus(id)` 函数

**处理流程**：
1. 创建 Knowledge 记录（status: pending）
2. 提取内容（根据 sourceType）
3. 清洗 + 分块
4. 调用 AI 蒸馏
5. 解析 + 校验结果
6. 更新 Knowledge 记录（status: completed）

#### 任务 2.7：实现 API 端点
- [ ] 创建 `POST /api/distill`（创建蒸馏任务）
- [ ] 创建 `GET /api/distill/[id]`（查询状态）
- [ ] 创建 `GET /api/distill`（任务列表）
- [ ] 实现认证中间件
- [ ] 实现输入校验（Zod）

#### 任务 2.8：实现设置页（API 配置）
- [ ] 创建 `GET/POST/PATCH/DELETE /api/settings/api-configs`
- [ ] 创建 `apps/web/src/app/(dashboard)/settings/page.tsx`
- [ ] 创建 API 配置表单组件
- [ ] 实现 API Key 加密存储
- [ ] 实现供应商切换

#### 任务 2.9：实现快速蒸馏页
- [ ] 创建 `apps/web/src/app/(dashboard)/page.tsx`（首页）
- [ ] 创建 `DistillForm` 组件（文本输入 + 提交）
- [ ] 创建 `DistillProgress` 组件（轮询状态）
- [ ] 创建 `DistillResult` 组件（展示结构化结果）
- [ ] 实现保存到知识库（自动保存）

### 3.3 验证
- [ ] 在设置页配置 OpenAI API Key
- [ ] 在首页粘贴 1000+ 字文本
- [ ] 点击蒸馏，5-10 秒内返回结构化结果
- [ ] 结果包含摘要、关键点、大纲、实体、推荐标签
- [ ] 结果自动保存到数据库

---

## 四、阶段 3：知识库管理 + 搜索

### 4.1 目标
蒸馏结果可持久化、可搜索、可管理。

### 4.2 任务清单

#### 任务 3.1：实现知识库服务
- [ ] 创建 `apps/web/src/services/knowledge.service.ts`
- [ ] 实现 `listKnowledge(userId, filters)` 分页查询
- [ ] 实现 `getKnowledge(id)`
- [ ] 实现 `updateKnowledge(id, data)`
- [ ] 实现 `deleteKnowledge(id)`（软删除）

#### 任务 3.2：实现标签服务
- [ ] 创建 `apps/web/src/services/tag.service.ts`（或合并到 knowledge.service）
- [ ] 实现 `listTags(userId)`
- [ ] 实现 `createTag(userId, name, color)`
- [ ] 实现 `deleteTag(id)`
- [ ] 实现 `attachTags(knowledgeId, tagIds[])`

#### 任务 3.3：实现搜索服务
- [ ] 创建 `apps/web/src/services/search.service.ts`
- [ ] 实现 `search(userId, query, filters)` 使用 ILIKE
- [ ] 支持按标签、时间范围、来源类型过滤
- [ ] 关键词高亮

#### 任务 3.4：实现知识库 API
- [ ] `GET /api/knowledge`（列表，支持分页 + 过滤）
- [ ] `GET /api/knowledge/[id]`（详情）
- [ ] `PATCH /api/knowledge/[id]`（更新）
- [ ] `DELETE /api/knowledge/[id]`（删除）
- [ ] `GET /api/search`（搜索）
- [ ] `GET/POST/DELETE /api/tags`

#### 任务 3.5：实现知识库列表页
- [ ] 创建 `apps/web/src/app/(dashboard)/library/page.tsx`
- [ ] 创建 `KnowledgeCard` 组件（卡片视图）
- [ ] 创建 `KnowledgeList` 组件（列表视图）
- [ ] 实现视图切换（卡片/列表）
- [ ] 实现 `TagFilter` 组件（标签过滤侧栏）
- [ ] 实现分页
- [ ] 实现空状态、加载态、错误态

#### 任务 3.6：实现知识详情页
- [ ] 创建 `apps/web/src/app/(dashboard)/knowledge/[id]/page.tsx`
- [ ] 创建 `KnowledgeDetail` 组件
- [ ] 展示：标题、摘要、关键点、大纲、标签、原文、元信息
- [ ] 实现编辑功能（标题、标签、笔记）
- [ ] 实现删除（确认弹窗）
- [ ] 展示关联知识（图谱边）

#### 任务 3.7：实现搜索页
- [ ] 创建 `apps/web/src/app/(dashboard)/search/page.tsx`
- [ ] 创建 `SearchBar` 组件（带自动补全）
- [ ] 展示搜索结果（高亮关键词）
- [ ] 支持过滤器（标签、时间、来源）

### 4.3 验证
- [ ] 蒸馏后可在知识库列表看到条目
- [ ] 可切换卡片/列表视图
- [ ] 可按标签过滤
- [ ] 可搜索关键词并高亮
- [ ] 可查看详情、编辑标签、删除

---

## 五、阶段 4：浏览器插件

### 5.1 目标
插件可一键蒸馏当前网页。

### 5.2 任务清单

#### 任务 4.1：初始化插件项目
- [ ] 创建 `apps/extension`
- [ ] 配置 `vite.config.ts`（CRXJS 插件）
- [ ] 创建 `manifest.json`（Manifest V3）
- [ ] 配置 React + TypeScript
- [ ] 创建图标资源

#### 任务 4.2：实现 Background Service Worker
- [ ] 创建 `apps/extension/src/background/index.ts`
- [ ] 实现 `action.onClicked` 监听（打开 Side Panel）
- [ ] 实现 `contextMenus` 创建（右键菜单）
- [ ] 实现消息路由（content script ↔ side panel ↔ API）

#### 任务 4.3：实现 Content Script
- [ ] 创建 `apps/extension/src/content/index.ts`
- [ ] 创建 `apps/extension/src/content/extractor.ts`
- [ ] 集成 `@mozilla/readability` + `jsdom`
- [ ] 实现 `extractPageContent()` 函数
- [ ] 提取标题、作者、发布时间、正文
- [ ] 实现选中内容提取

#### 任务 4.4：实现 Side Panel UI
- [ ] 创建 `apps/extension/src/sidepanel/index.html`
- [ ] 创建 `apps/extension/src/sidepanel/main.tsx`
- [ ] 创建 `apps/extension/src/sidepanel/App.tsx`
- [ ] 创建 `DistillPanel` 组件（预览 + 蒸馏按钮）
- [ ] 创建 `ResultView` 组件（展示蒸馏结果）
- [ ] 实现登录态检查（未登录引导到 Web 端）

#### 任务 4.5：实现 API 通信
- [ ] 创建 `apps/extension/src/lib/api.ts`
- [ ] 封装 fetch 请求（带认证 token）
- [ ] 实现 `createDistillTask()`
- [ ] 实现 `getDistillStatus()`（轮询）
- [ ] 实现 `saveKnowledge()`

#### 任务 4.6：实现登录态管理
- [ ] 创建 `apps/extension/src/lib/auth.ts`
- [ ] 通过 `chrome.storage.local` 存储 token
- [ ] 实现 token 刷新
- [ ] 实现未登录时的引导界面

#### 任务 4.7：实现完整交互流程
- [ ] 点击插件图标 → 打开 Side Panel
- [ ] Side Panel 显示页面预览
- [ ] 点击"一键蒸馏" → 调用 API
- [ ] 轮询蒸馏状态 → 展示进度
- [ ] 展示蒸馏结果 → 可编辑标签
- [ ] 点击"保存" → 入库
- [ ] 右键菜单"蒸馏选中内容"

### 5.3 验证
- [ ] 在 Chrome 开发者模式加载插件
- [ ] 在任意文章页点击插件图标
- [ ] Side Panel 显示页面预览
- [ ] 一键蒸馏 10 秒内完成
- [ ] 结果自动保存到知识库
- [ ] 在 Web 端可看到该条目

---

## 六、阶段 5：知识图谱

### 6.1 目标
可视化知识关联。

### 6.2 任务清单

#### 任务 5.1：实现图谱服务
- [ ] 创建 `apps/web/src/services/graph.service.ts`
- [ ] 实现 `calculateRelationWeight(newK, existingK)` 函数
- [ ] 实现 `createConnections(newKnowledgeId, userId)` 函数
- [ ] 在蒸馏完成后自动调用 `createConnections`

#### 任务 5.2：实现图谱 API
- [ ] 创建 `GET /api/graph`
- [ ] 支持 `tag`、`timeRange` 过滤参数
- [ ] 返回 `{ nodes, edges }` 结构
- [ ] 节点包含 `degree`（连接数）

#### 任务 5.3：实现图谱可视化
- [ ] 安装 `@xyflow/react`
- [ ] 创建 `apps/web/src/app/(dashboard)/graph/page.tsx`
- [ ] 创建 `KnowledgeGraph` 组件
- [ ] 创建自定义 `GraphNode` 组件（显示标题 + 标签颜色）
- [ ] 配置力导向布局
- [ ] 实现节点点击跳转
- [ ] 实现边悬停显示关联强度
- [ ] 实现 `GraphControls`（缩放、重置、过滤）

#### 任务 5.4：实现图谱过滤
- [ ] 标签过滤器
- [ ] 时间范围过滤器
- [ ] 关联强度阈值滑块

### 6.3 验证
- [ ] 蒸馏 5+ 篇相关文章
- [ ] 图谱页面显示节点和边
- [ ] 节点大小反映连接数
- [ ] 点击节点跳转详情
- [ ] 过滤器正常工作

---

## 七、阶段 6：PDF + 抖音/小红书媒体蒸馏

### 7.1 目标
支持 PDF 文件（基于 opendataloader-pdf）、抖音视频、小红书笔记的蒸馏，打磨体验。

### 7.2 任务清单

#### 6.A PDF 蒸馏（基于 opendataloader-pdf）

##### 任务 6.1：实现文件上传
- [ ] 创建 `POST /api/upload`（multipart/form-data）
- [ ] 限制文件大小 20MB
- [ ] 限制文件类型（pdf, txt, md）
- [ ] 保存到本地 `uploads/` 目录

##### 任务 6.2：实现 Python 服务 PDF 解析端点
- [ ] 创建 `services/media-processor/app/api/pdf.py`
- [ ] 创建 `services/media-processor/app/core/pdf_extractor.py`（封装 opendataloader-pdf）
- [ ] 实现 `POST /pdf/extract`（接收文件，返回 Markdown）
- [ ] 支持 Hybrid 模式（扫描件 OCR、复杂表格）
- [ ] 编写 `tests/test_pdf.py` 测试

##### 任务 6.3：实现 Next.js 端 PDF 蒸馏
- [ ] 创建 `apps/web/src/lib/media/client.ts`（Python 服务客户端）
- [ ] 创建 `apps/web/src/lib/extractor/pdf.ts`（调用 Python 服务）
- [ ] 在 `distill.service` 中添加 PDF 分支
- [ ] 大 PDF 分块蒸馏（每块 4000 tokens）
- [ ] 合并多块蒸馏结果

#### 6.B 抖音视频蒸馏

##### 任务 6.4：实现抖音视频下载模块
- [ ] 创建 `services/media-processor/app/core/downloader.py`
- [ ] 封装 yt-dlp 下载抖音视频
- [ ] 提取视频元数据（标题、作者、时长）
- [ ] 支持 Cookie 配置（反爬）
- [ ] 编写 `tests/test_douyin.py` 测试

##### 任务 6.5：实现音频分离模块
- [ ] 创建 `services/media-processor/app/core/audio_extractor.py`
- [ ] 使用 ffmpeg-python 从视频分离音频
- [ ] 转为 16kHz 单声道 wav（ASR 友好格式）

##### 任务 6.6：实现 ASR 语音识别模块
- [ ] 创建 `services/media-processor/app/core/asr_provider.py`
- [ ] 实现 `ASRProvider` 抽象基类
- [ ] 实现 `WhisperLocalProvider`（本地 Whisper 兜底）
- [ ] 实现 `CloudASRProvider`（通义听悟/讯飞/OpenAI Whisper API）
- [ ] 实现 `get_asr_provider()` 工厂函数
- [ ] 编写 `tests/test_asr.py` 测试

##### 任务 6.7：实现抖音处理 API 端点
- [ ] 创建 `services/media-processor/app/api/douyin.py`
- [ ] 实现 `POST /media/douyin`（下载 → 分离音频 → ASR）
- [ ] 创建 `services/media-processor/app/schemas/media.py`（Pydantic 模型）
- [ ] 实现临时文件清理（处理完即删）
- [ ] 错误处理（链接无效、视频删除、无语音）

##### 任务 6.8：实现 Next.js 端抖音蒸馏集成
- [ ] 在 `lib/media/client.ts` 添加 `processDouyinVideo()`
- [ ] 在 `distill.service` 添加 `douyin` 分支
- [ ] 保存媒体元数据到 `Knowledge.mediaMeta`
- [ ] 首页添加"抖音链接"输入入口

#### 6.C 小红书笔记蒸馏

##### 任务 6.9：实现小红书内容提取模块
- [ ] 创建 `services/media-processor/app/core/xhs_extractor.py`
- [ ] 使用 requests + BeautifulSoup 提取笔记
- [ ] 区分图文笔记和视频笔记
- [ ] 提取标题、正文、图片 URL、视频 URL
- [ ] 支持 Cookie 配置
- [ ] 编写 `tests/test_xiaohongshu.py` 测试

##### 任务 6.10：实现小红书处理 API 端点
- [ ] 创建 `services/media-processor/app/api/xiaohongshu.py`
- [ ] 实现 `POST /media/xiaohongshu`
- [ ] 图文笔记：直接返回文本
- [ ] 视频笔记：复用抖音视频处理流程

##### 任务 6.11：实现 Next.js 端小红书蒸馏集成
- [ ] 在 `lib/media/client.ts` 添加 `processXiaohongshuNote()`
- [ ] 在 `distill.service` 添加 `xiaohongshu` 分支
- [ ] 首页添加"小红书链接"输入入口

#### 6.D 统一 UI 与体验优化

##### 任务 6.12：实现统一蒸馏入口 UI
- [ ] 首页改造：支持文本/PDF/抖音链接/小红书链接多 Tab 切换
- [ ] 创建 `FileUpload` 组件（拖拽 + 点击）
- [ ] 创建 `LinkInput` 组件（抖音/小红书链接输入 + 自动识别）
- [ ] 显示上传进度 + 蒸馏进度

##### 任务 6.13：实现流式进度反馈
- [ ] 实现 SSE 端点 `/api/distill/[id]/stream`
- [ ] 推送各阶段进度（下载中 → 分离音频中 → 识别中 → 蒸馏中）
- [ ] 前端 EventSource 接收

##### 任务 6.14：体验优化
- [ ] 移动端响应式适配
- [ ] 加载骨架屏
- [ ] 错误重试机制
- [ ] 蒸馏结果可编辑后保存
- [ ] 视频蒸馏结果展示媒体元数据（作者、时长、平台）

### 7.3 验证
- [ ] 上传 50 页 PDF，30 秒内完成蒸馏
- [ ] 上传扫描件 PDF，Hybrid 模式正确 OCR
- [ ] 上传超过 20MB 文件被拒绝
- [ ] 粘贴抖音短视频链接，60 秒内完成蒸馏
- [ ] 粘贴抖音长视频链接，3 分钟内完成蒸馏
- [ ] 粘贴无效抖音链接，返回清晰错误
- [ ] 粘贴小红书图文笔记链接，正确提取并蒸馏
- [ ] 粘贴小红书视频笔记链接，正确处理视频并蒸馏
- [ ] 临时视频/音频文件处理完成后已删除
- [ ] 首页多 Tab 切换正常
- [ ] SSE 进度反馈正常显示各阶段
- [ ] 视频蒸馏结果展示媒体元数据

---

## 八、阶段 7：打磨与部署

### 8.1 目标
生产可用。

### 8.2 任务清单

#### 任务 7.1：UI/UX 打磨
- [ ] 统一加载态、空状态、错误态设计
- [ ] 微交互动画（按钮悬停、过渡效果）
- [ ] 暗色模式支持（可选）
- [ ] 移动端适配检查

#### 任务 7.2：性能优化
- [ ] 数据库索引优化
- [ ] N+1 查询排查
- [ ] API 响应缓存
- [ ] 前端代码分割
- [ ] 图片/资源优化

#### 任务 7.3：安全加固
- [ ] 速率限制实现
- [ ] 输入校验完善
- [ ] XSS/SQL 注入防护检查
- [ ] API Key 加密验证
- [ ] 用户数据隔离测试

#### 任务 7.4：部署配置
- [ ] 创建 `Dockerfile`（Web 应用）
- [ ] 创建 `docker-compose.yml`（Web + PostgreSQL）
- [ ] 配置生产环境变量
- [ ] 创建部署文档

#### 任务 7.5：文档与发布
- [ ] 完善 `README.md`
- [ ] 编写用户使用指南
- [ ] 插件打包（`pnpm build`）
- [ ] 准备演示数据

### 8.3 验证
- [ ] 完整用户旅程：注册 → 配置 → 蒸馏 → 知识库 → 图谱
- [ ] 性能指标达标（见 PRD 6.1）
- [ ] Docker 部署成功
- [ ] 插件可加载使用

---

## 九、并行化策略

### 9.1 可并行的任务

| 阶段 | 可并行任务 | 说明 |
|------|-----------|------|
| 阶段 2 | 任务 2.2（各供应商适配器） | 5 个适配器可并行开发 |
| 阶段 3 | 任务 3.5/3.6/3.7 | 列表页、详情页、搜索页可并行 |
| 阶段 4 | 任务 4.2/4.3/4.4 | Background、Content、Side Panel 可并行 |
| 阶段 5 | 任务 5.1/5.3 | 服务层与 UI 可并行（先定义接口） |

### 9.2 关键路径

```
阶段 1 → 阶段 2（蒸馏核心）→ 阶段 4（插件）→ 阶段 7（部署）
```

阶段 3 和阶段 5 可与阶段 4 部分并行。

---

## 十、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| LLM API 输出不稳定 | 高 | 高 | JSON Mode + Schema 校验 + 重试 + 降级 |
| 大 PDF 处理超时 | 中 | 中 | 分块 + 异步 + 进度反馈 |
| 知识图谱关联质量低 | 中 | 中 | 多维度关联 + 阈值过滤 + 人工调整 |
| 浏览器插件审核慢 | 低 | 低 | 开发者模式加载，不依赖 Web Store |
| 数据库全文搜索中文支持 | 中 | 中 | MVP 用 ILIKE，后续升级 zhparser |
| 多供应商 API 差异 | 中 | 中 | 统一接口 + 充分测试 |

---

## 十一、质量保证

### 11.1 代码质量
- TypeScript 严格模式
- ESLint + Prettier 统一风格
- 关键服务单元测试
- API 端点集成测试

### 11.2 验证检查点
每个阶段结束前需验证：
- [ ] 功能按预期工作
- [ ] 无控制台错误
- [ ] 响应式适配正常
- [ ] 错误处理完善
- [ ] 代码通过 lint 和 typecheck

---

## 十二、交付物清单

### 12.1 代码
- [ ] `apps/web` 完整 Next.js 应用
- [ ] `apps/extension` Chrome 扩展
- [ ] `packages/shared` 共享类型包
- [ ] 数据库迁移文件

### 12.2 文档
- [ ] `README.md`（项目说明 + 启动指南）
- [ ] `.env.example`（环境变量模板）
- [ ] 部署文档

### 12.3 可交付产物
- [ ] Web 应用（可访问的 URL）
- [ ] Chrome 扩展（.zip 包）
- [ ] 演示账号 + 演示数据
