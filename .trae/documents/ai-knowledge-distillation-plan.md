# AI 知识蒸馏站 - 实施计划

> 项目名称：**Distill**（暂定）—— AI 驱动的个人知识蒸馏与图谱系统
> 创建日期：2026-06-17
> 项目类型：2026 AI TRAE 创造力大赛参赛作品
> MVP 范围：浏览器插件 + Web 端

---

## 一、项目概要

### 1.1 解决的问题
信息过载时代，用户"收藏即学习"的错觉普遍存在：网盘存满、书签数百条，但真正吸收不足 5%。信息输入与内化之间存在巨大鸿沟。

### 1.2 产品定位
一款浏览器插件 + Web 端联动的个人知识管理系统，支持一键导入任意格式信息源，通过 AI 蒸馏核心要点，自动建立知识图谱关联，实现"输入即内化"。

### 1.3 目标用户
- 职场白领、在校研究生、终身学习者、知识工作者
- 场景：刷到优质公众号文章、听完行业课程、开完长会、下载行业报告时

### 1.4 核心价值
- 信息消化效率提升 10 倍：3 小时精读内容 → 5 分钟掌握核心
- 自动结构化笔记 + 知识图谱关联
- 为后续艾宾浩斯复习系统打下基础

---

## 二、MVP 范围（已确认）

### 2.1 包含的功能
1. **一键蒸馏 + 结构化总结**：从网页/PDF/文本提取核心要点，生成结构化总结（大纲/摘要/思维导图）
2. **知识库管理 + 搜索**：自动保存到个人知识库，支持标签、分类、全文搜索
3. **知识图谱关联**：多个知识点自动建立关联，形成个人知识图谱可视化

### 2.2 不包含（留待 v2）
- 移动端 App
- 艾宾浩斯间隔复习 + 闪卡
- 多人协作
- 离线模式

### 2.3 技术决策
| 维度 | 决策 | 理由 |
|------|------|------|
| MVP 形态 | 浏览器插件 + Web 端 | 最快验证核心价值，导入体验最佳 |
| AI 方案 | 云端大模型 API（多供应商可配置） | 开发快、效果好，避免本地部署复杂度 |
| 技术栈 | TypeScript 全栈 | 一套语言打通前后端，类型安全 |
| 后端框架 | Next.js 14 App Router + API Routes | 与前端统一，部署简单 |
| 数据库 | PostgreSQL + Prisma ORM | 关系型 + 全文搜索 + 图谱查询 |
| 认证 | NextAuth.js (GitHub/Email) | 开箱即用，支持多 Provider |

---

## 三、系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       用户层 (User Layer)                    │
├──────────────────────┬──────────────────────────────────────┤
│  Chrome Extension    │         Web App (Next.js)            │
│  ────────────────    │         ────────────────             │
│  · Content Script    │         · 知识库管理                  │
│    (页面内容提取)     │         · 全文搜索                    │
│  · Side Panel UI     │         · 知识图谱可视化              │
│    (蒸馏交互)        │         · 蒸馏详情查看                │
│  · Background        │         · 标签/分类管理               │
│    (API 通信)        │         · 用户设置                   │
└──────────┬───────────┴──────────────┬───────────────────────┘
           │                          │
           │       HTTPS REST         │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    API 层 (Next.js API Routes)               │
│  ─────────────────────────────────────────────────────────   │
│  · /api/auth/*        认证 (NextAuth)                        │
│  · /api/distill/*     蒸馏任务 (创建/查询/列表)              │
│  · /api/knowledge/*   知识库 CRUD                            │
│  · /api/search        全文搜索                                │
│  · /api/graph         知识图谱查询                            │
│  · /api/tags/*        标签管理                                │
│  · /api/upload        文件上传 (PDF/TXT/MD)                  │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Service Layer)                    │
│  ─────────────────────────────────────────────────────────   │
│  · DistillService     蒸馏编排（提取→清洗→AI总结→结构化）   │
│  · AIProviderAdapter  多供应商适配器                          │
│  · KnowledgeGraph     图谱构建（实体抽取+关系建模）          │
│  · SearchService      全文搜索（PostgreSQL tsvector）        │
│  · StorageService     文件存储                                │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Data Layer)                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│  PostgreSQL     │  本地文件存储    │  外部 LLM API           │
│  ───────────    │  ───────────    │  ───────────            │
│  · users        │  · 上传的 PDF   │  · OpenAI               │
│  · knowledge    │  · 提取的原文    │  · Anthropic            │
│  · tags         │                 │  · 通义千问              │
│  · connections  │                 │  · DeepSeek             │
│  · ai_usage     │                 │  · 智谱 GLM             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### 3.2 项目目录结构

```
e:\#2026AI_TRAE_创造力大赛\
├── apps/
│   ├── web/                          # Next.js 主应用（Web 端 + API）
│   │   ├── src/
│   │   │   ├── app/                  # App Router
│   │   │   │   ├── (auth)/           # 登录/注册页
│   │   │   │   ├── (dashboard)/      # 主工作区
│   │   │   │   │   ├── library/      # 知识库列表
│   │   │   │   │   ├── knowledge/    # 知识详情
│   │   │   │   │   ├── graph/        # 知识图谱
│   │   │   │   │   ├── search/       # 搜索
│   │   │   │   │   └── settings/     # 设置（API Key 配置）
│   │   │   │   ├── api/              # API Routes
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── distill/
│   │   │   │   │   ├── knowledge/
│   │   │   │   │   ├── search/
│   │   │   │   │   ├── graph/
│   │   │   │   │   ├── tags/
│   │   │   │   │   └── upload/
│   │   │   │   └── layout.tsx
│   │   │   ├── components/           # React 组件
│   │   │   │   ├── ui/               # 基础 UI（基于 shadcn/ui）
│   │   │   │   ├── knowledge/        # 知识库相关组件
│   │   │   │   ├── graph/            # 图谱可视化组件
│   │   │   │   └── distill/          # 蒸馏相关组件
│   │   │   ├── lib/                  # 工具库
│   │   │   │   ├── ai/               # AI 供应商适配器
│   │   │   │   ├── db/               # Prisma 客户端
│   │   │   │   ├── auth/             # 认证配置
│   │   │   │   └── utils/            # 通用工具
│   │   │   ├── services/             # 业务服务层
│   │   │   │   ├── distill.service.ts
│   │   │   │   ├── knowledge.service.ts
│   │   │   │   ├── graph.service.ts
│   │   │   │   └── search.service.ts
│   │   │   └── types/                # TypeScript 类型定义
│   │   ├── prisma/
│   │   │   └── schema.prisma         # 数据库 Schema
│   │   ├── public/
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   └── extension/                    # Chrome 扩展
│       ├── src/
│       │   ├── background/           # Service Worker
│       │   │   └── index.ts
│       │   ├── content/              # 内容脚本
│       │   │   ├── extractor.ts      # 页面内容提取
│       │   │   └── index.ts
│       │   ├── sidepanel/            # 侧边栏 UI
│       │   │   ├── App.tsx
│       │   │   └── main.tsx
│       │   ├── popup/                # 弹窗（快捷操作）
│       │   │   └── ...
│       │   ├── components/           # 共享组件
│       │   ├── lib/
│       │   │   ├── api.ts            # 与后端 API 通信
│       │   │   └── storage.ts        # 本地存储
│       │   └── types/
│       ├── manifest.json             # Manifest V3
│       ├── vite.config.ts
│       └── package.json
│
├── packages/                         # 共享包（monorepo）
│   └── shared/                       # 共享类型与工具
│       ├── src/
│       │   ├── types/                # 前后端共享类型
│       │   └── constants/
│       └── package.json
│
├── package.json                      # monorepo 根配置
├── pnpm-workspace.yaml               # pnpm workspace
├── turbo.json                        # Turborepo
├── .env.example                      # 环境变量模板
├── .gitignore
└── README.md
```

---

## 四、数据库设计（Prisma Schema）

### 4.1 核心模型

```prisma
// User 用户
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  image         String?
  emailVerified DateTime?
  accounts      Account[]
  sessions      Session[]
  knowledge     Knowledge[]
  tags          Tag[]
  apiConfigs    ApiConfig[]   // 用户配置的 LLM API Key
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ApiConfig 用户的多供应商 API 配置
model ApiConfig {
  id        String   @id @default(cuid())
  userId    String
  provider  String   // openai | anthropic | qwen | deepseek | zhipu
  apiKey    String   // 加密存储
  model     String   // 默认模型
  isActive  Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// Knowledge 知识条目
model Knowledge {
  id          String   @id @default(cuid())
  userId      String
  title       String
  sourceType  String   // url | pdf | text | markdown
  sourceUrl   String?
  rawContent  String   @db.Text  // 原始内容
  summary     String   @db.Text  // AI 生成的摘要
  outline     Json?    // 结构化大纲
  mindMap     Json?    // 思维导图数据
  keyPoints   Json?    // 关键要点数组
  entities    Json?    // 抽取的实体（用于图谱）
  status      String   @default("pending") // pending | processing | completed | failed
  wordCount   Int      @default(0)
  readingTime Int      @default(0) // 预计阅读时间（分钟）
  distillTime Int      @default(0) // 蒸馏耗时（秒）
  tokensUsed  Int      @default(0)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags        KnowledgeTag[]
  connectionsFrom KnowledgeConnection[] @relation("from")
  connectionsTo   KnowledgeConnection[] @relation("to")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([userId, status])
}

// Tag 标签
model Tag {
  id        String       @id @default(cuid())
  userId    String
  name      String
  color     String       @default("#6366f1")
  knowledge KnowledgeTag[]
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())

  @@unique([userId, name])
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
  id          String   @id @default(cuid())
  fromId      String
  toId        String
  relation    String   // related | similar | references | extends
  weight      Float    @default(0.5) // 关联强度 0-1
  from        Knowledge @relation("from", fields: [fromId], references: [id], onDelete: Cascade)
  to          Knowledge @relation("to", fields: [toId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([fromId, toId, relation])
  @@index([fromId])
  @@index([toId])
}
```

### 4.2 全文搜索
使用 PostgreSQL 的 `tsvector` + GIN 索引实现中文全文搜索：
- 对 `title`、`summary`、`rawContent` 建立复合 tsvector
- 使用 `pg_jieba` 或 `zhparser` 扩展支持中文分词
- 若环境不支持扩展，降级为 `ILIKE` 模糊查询 + 应用层分词

---

## 五、核心模块详细设计

### 5.1 AI 供应商适配器（多供应商可配置）

**文件**：`apps/web/src/lib/ai/provider.ts`

```typescript
// 统一接口
interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk>;
}

// 适配器实现
class OpenAIProvider implements AIProvider { ... }
class AnthropicProvider implements AIProvider { ... }
class QwenProvider implements AIProvider { ... }      // 通义千问
class DeepSeekProvider implements AIProvider { ... }
class ZhipuProvider implements AIProvider { ... }     // 智谱 GLM

// 工厂 + 路由
class AIProviderFactory {
  static create(provider: string, config: ApiConfig): AIProvider;
}
```

**关键设计**：
- 用户在设置页配置各供应商 API Key（AES 加密存储）
- 可设置默认供应商 + 按任务类型路由（如长文档用 Claude，快速总结用 DeepSeek）
- 统一错误处理 + 重试 + 限流

### 5.2 蒸馏服务（核心业务逻辑）

**文件**：`apps/web/src/services/distill.service.ts`

**蒸馏流水线**：

```
输入源 → 内容提取 → 清洗预处理 → 分块(Chunking) → AI 蒸馏 → 结构化 → 实体抽取 → 图谱关联 → 入库
```

**详细步骤**：

1. **内容提取**（`apps/web/src/lib/ai/extractor.ts`）
   - URL：服务端 fetch + Readability.js 提取正文
   - PDF：pdf-parse 提取文本
   - 文本/Markdown：直接使用
   - 浏览器插件：content script 提取后传给后端

2. **清洗预处理**
   - 去除广告、导航、页脚等噪声
   - 统一编码、去除乱码
   - 超长内容分块（按 token 数，overlap 200 tokens）

3. **AI 蒸馏 Prompt 设计**
   ```
   你是一位知识蒸馏专家。请将以下内容蒸馏为结构化知识卡片：
   
   要求：
   1. 生成 200 字以内的核心摘要
   2. 提取 3-7 个关键要点（每个不超过 50 字）
   3. 生成层级大纲（最多 3 级）
   4. 抽取核心实体（人名/概念/组织/技术等），用于知识图谱
   5. 推荐 3-5 个标签
   
   输出格式：JSON
   {
     "summary": "...",
     "keyPoints": ["...", "..."],
     "outline": [{"title": "...", "children": [...]}],
     "entities": [{"name": "...", "type": "..."}],
     "suggestedTags": ["...", "..."]
   }
   ```

4. **结构化输出**：使用 OpenAI Function Calling / JSON Mode 确保输出可解析

5. **实体抽取 + 图谱关联**（`apps/web/src/services/graph.service.ts`）
   - 从蒸馏结果抽取实体
   - 与用户已有知识的实体做相似度匹配（基于标签 + 实体重叠）
   - 自动创建 `KnowledgeConnection`（relation: similar/related）
   - 关联强度 weight 基于实体重叠率计算

### 5.3 浏览器插件设计

**Manifest V3 关键配置**：

```json
{
  "manifest_version": 3,
  "name": "Distill - AI 知识蒸馏",
  "version": "1.0.0",
  "permissions": ["sidePanel", "activeTab", "storage", "contextMenus"],
  "host_permissions": ["<all_urls>"],
  "action": { "default_title": "打开蒸馏面板" },
  "side_panel": { "default_path": "sidepanel.html" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

**核心交互流程**：
1. 用户在任意网页点击插件图标 → 打开 Side Panel
2. Side Panel 显示当前页面提取的标题/摘要预览
3. 用户点击"一键蒸馏" → 调用后端 `/api/distill` 接口
4. 流式返回蒸馏进度 → 实时展示结构化结果
5. 用户可编辑标签、补充笔记 → 保存到知识库

**内容提取策略**（`apps/extension/src/content/extractor.ts`）：
- 优先使用 Mozilla Readability 算法提取正文
- 保留标题、作者、发布时间等元数据
- 对 PDF 页面：提示用户使用"上传 PDF"功能
- 提取选中内容：支持右键菜单"蒸馏选中内容"

### 5.4 知识图谱可视化

**技术选型**：React Flow（@xyflow/react）
- 轻量、可交互、支持自定义节点
- 力导向布局自动排列
- 节点点击跳转到知识详情

**图谱查询**（`apps/web/src/services/graph.service.ts`）：
- 查询用户所有知识节点 + 连接边
- 支持按标签过滤、按时间范围过滤
- 节点大小反映连接数（度中心性）
- 边粗细反映关联强度

### 5.5 认证与安全

- **NextAuth.js**：支持 GitHub OAuth + 邮箱密码
- **API Key 加密**：用户配置的 LLM API Key 使用 AES-256-GCM 加密，密钥来自环境变量
- **速率限制**：基于用户 ID 的蒸馏任务限流（如每小时 20 次）
- **输入校验**：Zod schema 校验所有 API 输入

---

## 六、关键技术依赖

### 6.1 Web 应用
```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "18.3.x",
    "react-dom": "18.3.x",
    "@prisma/client": "5.x",
    "next-auth": "4.24.x",
    "zod": "3.x",
    "tailwindcss": "3.x",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "...",
    "clsx": "...",
    "tailwind-merge": "...",
    "@xyflow/react": "12.x",
    "lucide-react": "...",
    "react-markdown": "...",
    "remark-gfm": "...",
    "pdf-parse": "...",
    "@mozilla/readability": "...",
    "jsdom": "...",
    "openai": "...",
    "@anthropic-ai/sdk": "...",
    "ioredis": "...",
    "nanoid": "..."
  },
  "devDependencies": {
    "typescript": "5.x",
    "prisma": "5.x",
    "eslint": "...",
    "prettier": "...",
    "vitest": "...",
    "@testing-library/react": "..."
  }
}
```

### 6.2 浏览器插件
```json
{
  "dependencies": {
    "react": "18.3.x",
    "react-dom": "18.3.x",
    "@crxjs/vite-plugin": "...",
    "vite": "5.x",
    "@mozilla/readability": "..."
  }
}
```

### 6.3 Monorepo 工具
- **pnpm**：包管理
- **Turborepo**：构建编排
- **TypeScript Project References**：类型共享

---

## 七、实施步骤（分阶段交付）

### 阶段 1：项目脚手架与基础设施（基础）
**目标**：搭建 monorepo 结构，跑通基础流程

1. 初始化 pnpm monorepo + Turborepo
2. 创建 `apps/web`（Next.js 14 + TypeScript + Tailwind + shadcn/ui）
3. 创建 `apps/extension`（Vite + CRXJS + React）
4. 创建 `packages/shared`（共享类型）
5. 配置 Prisma + PostgreSQL，编写初始 schema
6. 配置 NextAuth.js（GitHub OAuth + Email）
7. 编写 `.env.example` 与环境变量文档

**验证**：Web 端可登录，插件可加载，数据库可连接

### 阶段 2：AI 供应商适配器 + 蒸馏核心
**目标**：跑通"文本输入 → AI 蒸馏 → 结构化输出"核心链路

1. 实现 `AIProvider` 接口与 5 个供应商适配器
2. 实现 `AIProviderFactory` + 配置加载
3. 实现蒸馏 Prompt 模板 + JSON 输出解析
4. 实现 `DistillService`（文本输入分支）
5. 创建 `/api/distill` 接口（POST 创建、GET 查询）
6. Web 端"快速蒸馏"页面：粘贴文本 → 实时蒸馏

**验证**：粘贴一篇长文，5 秒内返回结构化总结

### 阶段 3：知识库管理 + 搜索
**目标**：蒸馏结果可持久化、可搜索、可管理

1. 完善 Knowledge/Tag 模型的 CRUD API
2. 实现全文搜索（PostgreSQL tsvector 或 ILIKE 降级）
3. Web 端知识库列表页（卡片/列表视图切换）
4. 知识详情页（摘要 + 大纲 + 关键点 + 标签）
5. 标签管理（创建、着色、过滤）
6. 设置页（API Key 配置、供应商切换）

**验证**：可创建、查看、搜索、删除知识条目

### 阶段 4：浏览器插件
**目标**：插件可一键蒸馏当前网页

1. Manifest V3 配置 + Side Panel UI
2. Content Script：Readability 提取正文
3. Background Service Worker：API 通信
4. Side Panel：蒸馏交互 + 流式展示
5. 右键菜单：蒸馏选中内容
6. 登录态同步（与 Web 端共享 cookie/token）

**验证**：在任意网页点击插件，5 秒内完成蒸馏并入库

### 阶段 5：知识图谱
**目标**：可视化知识关联

1. 实体抽取逻辑（蒸馏时自动抽取）
2. 图谱关联算法（基于实体重叠 + 标签相似度）
3. `/api/graph` 接口（返回节点 + 边）
4. React Flow 图谱可视化组件
5. 节点交互（点击跳转、悬停高亮关联）
6. 过滤器（按标签、按时间）

**验证**：蒸馏 5+ 篇相关文章后，图谱显示有意义的关联

### 阶段 6：PDF 导入 + 优化
**目标**：支持 PDF 文件蒸馏，打磨体验

1. 文件上传接口（multipart/form-data）
2. pdf-parse 文本提取
3. 上传进度 + 大文件分块处理
4. 蒸馏进度流式反馈（SSE）
5. 错误处理与重试
6. 移动端响应式适配

**验证**：上传 50 页 PDF，30 秒内完成蒸馏

### 阶段 7：打磨与部署
**目标**：生产可用

1. UI/UX 打磨（加载态、空状态、错误态）
2. 性能优化（数据库索引、N+1 查询、缓存）
3. 速率限制 + 用量统计
4. Docker Compose 部署配置
5. README 与用户文档
6. 插件打包发布到 Chrome Web Store（或开发者模式加载）

**验证**：完整用户旅程跑通，可演示

---

## 八、假设与决策

### 8.1 关键假设
1. **部署环境**：假设有 PostgreSQL 数据库可用（本地或云）
2. **LLM API**：用户自行注册并配置 API Key（产品不内置 Key，避免成本）
3. **浏览器**：MVP 仅支持 Chrome/Edge（Chromium 内核），Firefox/Safari 后续
4. **文件存储**：MVP 使用本地文件系统存储上传的 PDF，生产环境可切换 S3
5. **中文分词**：优先尝试 `zhparser` 扩展，不支持则降级 `ILIKE`

### 8.2 关键决策
1. **不做移动端**：MVP 聚焦桌面端，移动端留待 v2，避免范围蔓延
2. **不做间隔复习**：用户未选，留待 v2，但数据模型预留扩展空间
3. **多供应商而非单一**：用户明确要求可配置，增加灵活性
4. **Monorepo**：前后端 + 插件共享类型，降低维护成本
5. **Next.js API Routes 而非独立后端**：MVP 阶段简化部署，后续可拆分

### 8.3 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM API 输出不稳定 | 蒸馏失败 | JSON Mode + 重试 + 降级解析 |
| 大 PDF 处理超时 | 用户体验差 | 分块处理 + 异步任务 + 进度反馈 |
| 知识图谱关联质量低 | 图谱无意义 | 多维度关联（实体+标签+语义）+ 人工调整 |
| 浏览器插件审核慢 | 无法发布 | 开发者模式加载，不依赖 Web Store |

---

## 九、验证步骤

### 9.1 功能验证清单
- [ ] 用户可注册/登录（GitHub OAuth + Email）
- [ ] 用户可在设置页配置至少一个 LLM API Key
- [ ] Web 端：粘贴文本 → 蒸馏 → 查看结构化结果 → 保存到知识库
- [ ] Web 端：上传 PDF → 蒸馏 → 保存
- [ ] 插件：在任意网页 → 点击插件 → 一键蒸馏 → 自动入库
- [ ] 知识库：列表查看、搜索、标签过滤、详情查看、删除
- [ ] 知识图谱：可视化展示、节点交互、过滤
- [ ] 多供应商切换正常工作

### 9.2 性能指标
- 单篇网页蒸馏：< 10 秒
- 50 页 PDF 蒸馏：< 30 秒
- 知识库列表加载：< 500ms
- 全文搜索：< 200ms
- 图谱渲染（100 节点）：< 1 秒

---

## 十、后续演进方向（v2+）

1. **艾宾浩斯间隔复习**：基于知识条目生成闪卡，按曲线推送复习
2. **移动端 App**：React Native，支持碎片化阅读
3. **语义搜索**：接入 Embedding 向量数据库（pgvector）
4. **AI 问答**：基于个人知识库的 RAG 问答
5. **多人协作**：知识库共享与团队蒸馏
6. **离线模式**：本地小模型兜底

---

*本计划基于 2026-06-17 的需求确认，MVP 范围已锁定。执行阶段如遇重大变更需重新评审。*
