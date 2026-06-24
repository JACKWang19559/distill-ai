# 【学习工作赛道】Distill —— AI 知识蒸馏站，一键把信息变知识

> **标签**：`学习工作`
>
> **标题**：【学习工作赛道】Distill —— AI 知识蒸馏站，一键把信息变知识

---

## 1. Demo 简介

### 是什么

**Distill** 是一款 **Chrome 浏览器插件 + Web 网站联动** 的 AI 个人知识蒸馏与图谱系统。用户在任意网页一键蒸馏，AI 自动提炼摘要、关键点、大纲、实体、推荐标签，自动入库并构建可视化知识图谱，实现"输入即内化"。

- 浏览器插件（Manifest V3）：一键蒸馏当前网页 / 选区 / 智能识别（文字 + 图片 + 视频）
- Web 站点（Next.js 16 + React 19）：知识库管理、全文搜索、知识图谱可视化、多 AI 供应商配置
- Python 媒体处理服务（FastAPI）：抖音 / 小红书视频下载 + ASR 语音识别 + PDF 解析

### 面向谁

| 用户画像 | 占比 | 核心场景 | 核心诉求 |
|---------|------|---------|---------|
| 职场白领 | 35% | 刷到优质公众号文章、行业报告 | 快速消化、留存核心观点 |
| 在校研究生 | 25% | 阅读论文、整理文献综述 | 结构化整理、建立知识关联 |
| 终身学习者 | 25% | 听完行业课程、读书笔记 | 高效内化、构建知识体系 |
| 知识工作者 | 15% | 开完 3 小时长会、整理会议纪要 | 快速提炼、可检索回溯 |

### 主要功能

**功能 1：一键智能蒸馏（核心）**
- 浏览器插件支持三种模式：整页蒸馏 / 选区蒸馏 / **智能识别**（自动提取文字、图片、视频）
- 支持 5 种输入源：网页 URL、PDF 文件、纯文本、抖音视频、小红书笔记
- 5 秒内返回结构化结果：200 字摘要 + 3-7 个关键点 + 层级大纲 + 推荐标签 + 实体抽取

**功能 2：知识库管理 + 全文搜索**
- 卡片视图 / 列表视图切换，支持标签过滤、时间筛选
- 全文搜索（标题、摘要、原文），关键词高亮
- 知识详情页：摘要 + 关键点 + 大纲 + 标签 + 原文 + 关联知识

**功能 3：知识图谱可视化**
- 蒸馏时自动抽取实体（人名 / 概念 / 组织 / 技术）
- 基于实体重叠 + 标签相似度自动建立关联（weight > 0.3）
- 力导向布局图谱，节点大小反映连接数，边粗细反映关联强度

**功能 4：多 AI 供应商适配**
- 支持 OpenAI / Anthropic / 通义千问 / DeepSeek / 智谱 GLM 五大供应商
- API Key 使用 AES-256-GCM 加密存储
- 可随时切换默认供应商

> 📸 **产品截图建议位置**：
> - 图 1：Web 端首页快速蒸馏界面（文本 / 网页 / PDF / 抖音 / 小红书 Tab 切换）
> - 图 2：浏览器插件 Side Panel 蒸馏结果展示
> - 图 3：知识图谱可视化页面（力导向布局）
> - 图 4：知识库列表页（卡片视图 + 标签过滤）

---

## 2. Demo 创作思路

### 灵感来源

作为重度信息消费者，我每天会刷到几十篇公众号文章、行业报告、抖音知识类视频。**收藏夹里躺着几百 G 资料，但真正消化吸收的不到 5%**。每次想用某个知识点时，要么找不到，要么记不清，要么发现当时根本没看懂。

我观察到一个普遍现象：**"收藏即学习"的错觉**。人们以为点了收藏就等于学到了，实际上信息只是沉睡在收藏夹里。现有的笔记软件（Notion / Obsidian）需要用户主动整理，没有解决"消化"这个最耗时的环节；现有的 AI 总结工具多为一次性总结，缺乏知识库沉淀与关联。

### 想解决的问题

**用户真实存在的三大痛点：**

1. **信息输入过载**：每天被海量文章、课程、会议录音、PDF 文档淹没，收藏了几百 G 资料却从未真正消化
2. **内化效率极低**：90% 的人有"收藏即学习"的错觉，真正吸收的不到 5%
3. **知识孤岛严重**：收藏的内容散落在网盘、书签、笔记各处，需要用时找不到、记不清，知识转化率不足 10%

### 为什么做这个方向

**判断与取舍：**

1. **痛点真实且高频**：信息过载是知识工作者的共同痛点，每天都有大量内容需要处理
2. **AI 能力成熟**：大模型的总结、抽取、结构化能力已经足够强，可以真正替代人工"消化"环节
3. **差异化定位**：不做又一个笔记软件，而是做"消化环节"的 AI 助手 + 知识图谱构建器
4. **技术栈契合**：浏览器插件 + Web 端 + Python 服务的组合，能覆盖多源信息输入

**核心取舍：**
- MVP 聚焦"蒸馏 + 图谱"核心链路，不做间隔复习、闪卡、多人协作（留待 v2）
- 视频源仅支持抖音 + 小红书（国内最主流的知识类短视频平台），不做 B 站 / YouTube
- 优先保证"一键蒸馏"的体验丝滑，而非追求功能大而全

---

## 3. Demo 体验地址

### 在线体验链接

🌐 **Web 端**：<https://distill-ai-eosin.vercel.app>

- 支持邮箱注册 / GitHub 登录
- 登录后进入 Dashboard，可粘贴文本 / URL / 抖音 / 小红书链接进行蒸馏
- 知识库页面查看蒸馏历史，知识图谱页面查看关联

🔌 **浏览器插件**：源码位于 `apps/extension/`，构建后加载到 Chrome 即可使用

> **体验提示**：蒸馏前需在「设置 → API 配置」中添加至少一个 AI 供应商的 API Key（推荐 DeepSeek，免费额度充足）。

---

## 4. TRAE 实践过程

### 4.1 整体开发流程

本项目从 0 到 1 完全使用 **TRAE IDE** 开发完成，采用"规格驱动 + 分阶段交付"的模式：

```
规格文档（PRD / Design / Plan / Checklist）
    ↓
阶段 1：项目脚手架与基础设施
    ↓
阶段 2：AI 供应商适配器 + 蒸馏核心
    ↓
阶段 3：知识库管理 + 全文搜索
    ↓
阶段 4：浏览器插件（一键蒸馏）
    ↓
阶段 5：知识图谱可视化
    ↓
阶段 6：PDF + 抖音/小红书媒体蒸馏
    ↓
阶段 7：打磨与 Vercel 部署
```

### 4.2 关键开发步骤

#### 步骤 1：规格文档生成（用 TRAE 的 Builder 模式）

在 TRAE IDE 中，我首先让 AI 根据一句话创意生成完整的规格文档套件：

> **Prompt 示例**：
> "我要做一个 AI 知识蒸馏站，浏览器插件 + Web 端联动，一键蒸馏网页内容，自动构建知识图谱。请帮我生成 PRD、Design、Plan、Checklist 四份规格文档。"

TRAE 自动生成了：
- `PRD.md`：产品需求文档（用户画像、功能范围、详细需求）
- `Design.md`：设计文档（系统架构、技术选型、数据模型）
- `Plan.md`：实施计划（7 阶段划分、任务清单、依赖关系）
- `checklist.md`：验收清单（每阶段的验证标准）

这些文档保存在 `.trae/specs/ai-knowledge-distillation/` 目录，后续所有开发都基于这些规格。

#### 步骤 2：Monorepo 脚手架搭建

使用 TRAE 的 Builder 模式，一次性生成 Monorepo 结构：

```
distill/
├── apps/
│   ├── web/              # Next.js 16 Web 端
│   └── extension/        # Chrome 浏览器插件
├── packages/
│   └── shared/           # 共享类型定义
├── services/
│   └── media-processor/  # Python FastAPI 媒体处理服务
├── pnpm-workspace.yaml
├── turbo.json
└── vercel.json
```

技术栈选型：
- **前端**：Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui
- **后端**：Next.js API Routes + Prisma 7 + PostgreSQL
- **认证**：NextAuth.js v5（GitHub OAuth + 邮箱密码）
- **图谱**：@xyflow/react + d3-force 力导向布局
- **AI**：多供应商适配器（OpenAI / Anthropic / Qwen / DeepSeek / Zhipu）
- **媒体**：Python FastAPI + yt-dlp + OpenAI Whisper + opendataloader-pdf

#### 步骤 3：AI 蒸馏核心链路开发

这是项目最核心的部分。在 TRAE 中，我通过对话逐步构建了蒸馏流水线：

**3.1 多供应商适配器**：TRAE 帮我生成了统一的 `AIProvider` 接口和 5 个供应商实现，支持流式输出和 JSON Mode。

**3.2 蒸馏 Prompt 工程**：通过多轮对话优化 Prompt，让 AI 输出结构化 JSON（摘要 + 关键点 + 大纲 + 实体 + 标签），并用 Zod Schema 校验。

**3.3 流式蒸馏 API**：`POST /api/distill/[id]/stream` 使用 Server-Sent Events 实时推送蒸馏进度。

#### 步骤 4：浏览器插件开发（踩坑最多）

浏览器插件是本项目最有挑战的部分，TRAE 在这个过程中帮了大忙：

**4.1 Manifest V3 + Side Panel**：TRAE 帮我配置了 Manifest V3 规范的 `manifest.json`，使用 Chrome 113+ 的 Side Panel API。

**4.2 智能识别模式**：原本是"选区蒸馏"，但小红书等站点图片和文字分离，选区无法包含图片。我让 TRAE 改造成"智能识别"模式，使用 Mozilla Readability + 自定义提取器，自动提取文字、图片、视频。

**4.3 跨域认证**：插件和 Web 端跨域，TRAE 帮我设计了 API Token 机制（长期令牌 + `chrome.storage.local` 持久化）。

**4.4 像素风 Icon 生成**：用 TRAE 生成 Python PIL 脚本，绘制像素风格的插件图标（16x16 / 48x48 / 128x128）。

#### 步骤 5：知识图谱可视化

使用 @xyflow/react + d3-force 实现力导向布局：

- 节点：知识条目，大小反映连接数
- 边：知识关联，粗细反映关联强度（基于实体重叠 + 标签相似度）
- 交互：拖拽、缩放、点击跳转详情、按标签 / 时间过滤

#### 步骤 6：Vercel 部署（踩坑收尾）

部署阶段遇到了几个典型问题，都在 TRAE 辅助下解决：

- **Prisma 7 配置迁移**：Prisma 7 将数据库连接从 `schema.prisma` 移到 `prisma.config.ts`，使用 driver adapter 模式
- **Supabase Postgres 连接**：添加 `POSTGRES_PRISMA_URL` 环境变量回退
- **NextAuth v5 Cookie 名称**：生产环境 Cookie 带 `__Secure-` 前缀，`getToken` 需指定 `cookieName: "authjs.session-token"`
- **Git 邮箱不匹配**：Vercel 要求 commit email 匹配 GitHub 账号，更新为 noreply 邮箱后解决

### 4.3 开发关键步骤截图

> 📸 **截图建议位置**（发布时请替换为实际截图）：
>
> **截图 1**：TRAE IDE 中规格文档生成对话
> - 展示 Builder 模式生成 PRD / Design / Plan / Checklist 的对话过程
>
> **截图 2**：TRAE IDE 中浏览器插件智能识别模式开发
> - 展示改造"选区蒸馏"为"智能识别"的对话，包含 `extractSmartContent()` 函数实现
>
> **截图 3**：TRAE IDE 中知识图谱可视化开发
> - 展示力导向布局 + 节点交互的实现对话
>
> **截图 4**：TRAE IDE 中 Vercel 部署问题排查
> - 展示 NextAuth Cookie 名称问题的调试对话
>
> **截图 5**：TRAE IDE 中像素风 Icon 生成
> - 展示用 Python PIL 生成像素风图标的对话

### 4.4 关键任务对话 Session ID

> ⚠️ **发布前请替换为实际 Session ID**（双击 TRAE 对话复制）：
>
> - **Session ID 1**：`<在此粘贴规格文档生成的 Session ID>`
>   - 任务：生成 PRD / Design / Plan / Checklist 规格文档套件
>   - 产出：`.trae/specs/ai-knowledge-distillation/` 目录下 4 份文档
>
> - **Session ID 2**：`<在此粘贴浏览器插件开发的 Session ID>`
>   - 任务：浏览器插件智能识别模式开发 + 小红书图片提取
>   - 产出：`apps/extension/src/content/index.ts` 中的 `extractSmartContent()` 等函数
>
> - **Session ID 3**：`<在此粘贴知识图谱开发的 Session ID>`
>   - 任务：知识图谱可视化 + 关联计算
>   - 产出：`apps/web/src/components/graph/` 和 `apps/web/src/services/graph.service.ts`
>
> - **Session ID 4**：`<在此粘贴 Vercel 部署的 Session ID>`
>   - 任务：Vercel 部署 + NextAuth Cookie 问题排查
>   - 产出：`vercel.json`、`prisma.config.ts`、`proxy.ts` 修复
>
> - **Session ID 5**：`<在此粘贴像素风 Icon 生成的 Session ID>`
>   - 任务：用 Python PIL 生成像素风插件图标
>   - 产出：`apps/extension/public/icons/` 下的三尺寸图标

---

## 5. 经验总结与开发心得

### 5.1 规格驱动开发的优势

在 TRAE 中先让 AI 生成规格文档，再基于规格开发，带来三大好处：

1. **减少返工**：规格文档明确了功能边界和验收标准，避免开发中频繁变更需求
2. **AI 上下文更清晰**：每次对话都能引用规格文档，AI 的输出更精准
3. **进度可追踪**：Checklist 让每个阶段的完成情况一目了然

### 5.2 TRAE Builder 模式的威力

对于复杂项目，TRAE 的 Builder 模式可以自主规划任务、拆解步骤、调用工具。本项目从脚手架到部署，大量工作由 Builder 自动完成，我只需要在关键节点审查和调整。

### 5.3 踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 小红书图片无法选中 | 图片和文字在不同容器，选区不包含图片 | 改造为"智能识别"模式，自动提取图片 |
| 插件跨域认证失败 | 插件和 Web 端不同域，Cookie 无法共享 | 设计 API Token 机制，长期令牌 + chrome.storage |
| Vercel 构建失败 | Prisma 7 配置方式变更 | 迁移到 `prisma.config.ts` + driver adapter |
| NextAuth 登录后重定向 | v5 Cookie 带 `__Secure-` 前缀 | `getToken` 指定 `cookieName: "authjs.session-token"` |
| Git 邮箱不匹配 | Commit email 与 GitHub 账号不一致 | 更新为 GitHub noreply 邮箱 |

### 5.4 项目数据

- **代码量**：TypeScript 约 8000 行，Python 约 1500 行
- **文件数**：80+ 个源文件
- **技术栈**：Next.js 16 / React 19 / Prisma 7 / NextAuth v5 / FastAPI / @xyflow/react
- **AI 供应商**：5 个（OpenAI / Anthropic / Qwen / DeepSeek / Zhipu）
- **开发周期**：约 3 天（从规格到部署）

---

## 6. 报名帖链接

> ⚠️ **发布前请替换为实际的报名帖链接**：
>
> 社区报名帖：<在此填写通过的报名帖链接>

---

## 7. 项目仓库

- **GitHub**：<https://github.com/JACKWang19559/distill-ai>
- **在线体验**：<https://distill-ai-eosin.vercel.app>

---

**感谢 TRAE 让一个人也能在 3 天内完成从创意到上线的全流程开发！** 🚀
