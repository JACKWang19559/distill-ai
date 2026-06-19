# Phase 6 媒体蒸馏集成设计文档

> **创建日期**：2026-06-18
> **关联文档**：[PRD.md](./PRD.md) | [Design.md](./Design.md) | [Plan.md](./Plan.md) | [tasks.md](./tasks.md)
> **实现范围**：Task 6.1, 6.3, 6.8, 6.11, 6.12（6.13 SSE / 6.14 UX 打磨延后）
> **实现方案**：方案 A — 后端优先分层实现

---

## 1. 背景与目标

### 1.1 当前状态

Python 媒体处理服务（`services/media-processor`）已就绪，提供 3 个核心端点：

| 端点 | 功能 | 状态 |
|------|------|------|
| `POST /pdf/extract` | PDF 解析（opendataloader-pdf） | ✅ 已完成 |
| `POST /pdf/extract-from-path` | 从服务端路径解析 PDF | ✅ 已完成 |
| `POST /media/douyin` | 抖音视频下载→分离音频→ASR | ✅ 已完成 |
| `POST /media/xiaohongshu` | 小红书笔记提取（图文/视频） | ✅ 已完成 |

Next.js 端 `distill.service.ts` 的 `prepareContent()` 对 `pdf`/`douyin`/`xiaohongshu` 三种来源类型抛出 `NotImplemented` 错误。

### 1.2 目标

实现 Next.js 端与 Python 服务的集成，打通 3 种媒体类型的完整蒸馏链路，并提供统一的多 Tab UI 入口。

### 1.3 非目标（本轮不做）

- SSE 流式进度反馈（Task 6.13，延后）
- 移动端适配、骨架屏、错误重试等 UX 打磨（Task 6.14，延后）
- 知识图谱自动建边（Phase 5）
- 浏览器插件（Phase 4）

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js Web App (apps/web)                                 │
│                                                             │
│  首页 UI (多 Tab)                                            │
│  ┌─────────┬─────────┬─────────┬────────────┐               │
│  │ 文本    │ URL     │ PDF     │ 抖音/小红书 │               │
│  └─────────┴─────────┴─────────┴────────────┘               │
│         │           │         │            │                │
│         ▼           ▼         ▼            ▼                │
│  POST /api/upload (仅 PDF)    │            │                │
│         │ filePath            │            │                │
│         ▼                     ▼            ▼                │
│  POST /api/distill (统一入口)                                │
│         │                                                   │
│         ▼                                                   │
│  distill.service.ts                                         │
│  prepareContent() ──┬─ text/markdown → 直接使用              │
│                     ├─ url → fetchUrlContent()               │
│                     ├─ pdf → extractPdf() ──────┐            │
│                     ├─ douyin → processDouyin() │            │
│                     └─ xiaohongshu → processXHS()│           │
│                                                │            │
│  lib/media/client.ts ◄────────────────────────┘            │
│  (Python 服务 HTTP 客户端)                                   │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Python Media Service (services/media-processor:8001)       │
│  POST /pdf/extract-from-path → opendataloader-pdf           │
│  POST /media/douyin          → yt-dlp + ffmpeg + ASR        │
│  POST /media/xiaohongshu     → BeautifulSoup + (视频复用)    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 设计原则

1. **单一职责**：`client.ts` 只负责 HTTP 调用，`distill.service.ts` 只负责编排，`extractor/pdf.ts` 只负责分块逻辑
2. **复用现有模式**：遵循 `distill.service.ts` 现有的 `prepareContent()` + `processDistillTask()` 模式
3. **错误隔离**：Python 服务故障不影响 text/url 蒸馏；小红书视频 ASR 失败降级为仅文本
4. **类型安全**：所有接口使用 TypeScript 类型，复用 `@distill/shared` 的 `MediaMeta`/`DistillInput`

---

## 3. 文件清单

### 3.1 新建文件

| 文件路径 | 职责 |
|---------|------|
| `apps/web/src/lib/config.ts` | 环境变量配置（`MEDIA_SERVICE_URL`） |
| `apps/web/src/lib/media/client.ts` | Python 服务 HTTP 客户端（3 个函数） |
| `apps/web/src/lib/extractor/pdf.ts` | PDF 分块蒸馏逻辑 |
| `apps/web/src/app/api/upload/route.ts` | 文件上传端点 |
| `apps/web/src/components/distill/file-upload.tsx` | PDF 拖拽上传组件 |
| `apps/web/src/components/distill/link-input.tsx` | 抖音/小红书链接输入组件 |

### 3.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `apps/web/src/services/distill.service.ts` | `prepareContent()` 添加 3 个分支 + `mediaMeta` 保存 |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | 多 Tab 改造（5 个 Tab） |

---

## 4. 详细设计

### 4.1 `lib/config.ts` — 环境变量配置

```typescript
/** Python 媒体处理服务地址 */
export const MEDIA_SERVICE_URL =
  process.env.MEDIA_SERVICE_URL ?? "http://localhost:8001";

/** 文件上传目录（相对于项目根） */
export const UPLOAD_DIR = "uploads";

/** 最大上传文件大小（字节） */
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB
```

### 4.2 `lib/media/client.ts` — Python 服务客户端

**接口定义：**

```typescript
/** PDF 解析结果 */
interface PdfExtractResult {
  markdown: string;
  pageCount: number;
  format: string;
  usedHybrid: boolean;
}

/** 抖音视频处理结果 */
interface DouyinProcessResult {
  transcript: string;
  title: string;
  author: string;
  duration: number;
  audioUrl: string | null;
}

/** 小红书笔记处理结果 */
interface XiaohongshuProcessResult {
  noteType: "image" | "video";
  title: string;
  content: string;
  transcript: string;
  author: string;
  videoUrl: string | null;
  tags: string[];
  ipLocation: string;
  likedCount: string;
  collectedCount: string;
  commentCount: string;
}

/** PDF 解析（调用 Python /pdf/extract-from-path） */
export async function extractPdf(
  filePath: string,
  useHybrid?: boolean
): Promise<PdfExtractResult>;

/** 抖音视频处理（调用 Python /media/douyin） */
export async function processDouyinVideo(
  url: string,
  cookie?: string
): Promise<DouyinProcessResult>;

/** 小红书笔记处理（调用 Python /media/xiaohongshu） */
export async function processXiaohongshuNote(
  url: string,
  cookie?: string
): Promise<XiaohongshuProcessResult>;
```

**关键实现细节：**

- **超时设置**：PDF 5 分钟（`AbortController` + `setTimeout`），抖音/小红书 10 分钟
- **task_id 生成**：`crypto.randomUUID()` 传给 Python 服务用于临时文件隔离
- **错误处理**：HTTP 非 2xx 时，解析响应体 `{detail: string}` 抛出 `Error`；网络错误直接抛出
- **PDF 调用方式**：使用 `extract-from-path` 端点（文件已在服务端，避免二次上传），传 `file_path` 和 `use_hybrid` 表单字段

### 4.3 `lib/extractor/pdf.ts` — PDF 分块蒸馏

**职责：** 当 PDF 解析出的 markdown 过长时，分块调用 AI 蒸馏，最后合并结果。

```typescript
/** 单块最大 token 估算（1 token ≈ 4 字符，保守取 4000 tokens = 16000 字符） */
const MAX_CHUNK_CHARS = 16_000;

/** 分块蒸馏 PDF 内容 */
export async function distillPdfInChunks(
  markdown: string,
  provider: AIProvider,
  systemPrompt: string
): Promise<DistillOutput>;
```

**合并策略：**
- `title`：取第一块的标题
- `summary`：拼接各块 summary，再让 AI 生成一个总 summary（可选优化，首版直接拼接）
- `keyPoints`：合并所有块的 keyPoints，去重（首版保留前 7 个）
- `outline`：拼接各块 outline
- `suggestedTags`：合并去重，取前 5 个
- `entities`：合并去重

**首版简化：** 若 markdown ≤ 16000 字符，直接走单次蒸馏（不分块）。分块逻辑仅在大 PDF 时触发。

### 4.4 `distill.service.ts` 改造

**`prepareContent()` 返回类型扩展：**

```typescript
async function prepareContent(
  input: DistillInput
): Promise<{ title: string; rawContent: string; mediaMeta?: MediaMeta }>;
```

**新增 3 个分支：**

```typescript
case "pdf": {
  if (!input.filePath) throw new Error("pdf 来源必须提供 filePath");
  const result = await extractPdf(input.filePath, input.useHybrid);
  return {
    title: `PDF 文档（${result.pageCount} 页）`,
    rawContent: result.markdown,
  };
}

case "douyin": {
  if (!input.sourceUrl) throw new Error("douyin 来源必须提供 sourceUrl");
  const result = await processDouyinVideo(input.sourceUrl, input.cookie);
  return {
    title: result.title || "抖音视频",
    rawContent: result.transcript,
    mediaMeta: {
      platform: "douyin",
      author: result.author,
      duration: result.duration,
      videoTitle: result.title,
    },
  };
}

case "xiaohongshu": {
  if (!input.sourceUrl) throw new Error("xiaohongshu 来源必须提供 sourceUrl");
  const result = await processXiaohongshuNote(input.sourceUrl, input.cookie);
  const content = result.transcript
    ? `${result.title}\n\n${result.content}\n\n视频转写：\n${result.transcript}`
    : `${result.title}\n\n${result.content}`;
  return {
    title: result.title || "小红书笔记",
    rawContent: content,
    mediaMeta: {
      platform: "xiaohongshu",
      author: result.author,
      noteType: result.noteType,
      tags: result.tags,
      ipLocation: result.ipLocation,
      likedCount: result.likedCount,
      collectedCount: result.collectedCount,
      commentCount: result.commentCount,
    },
  };
}
```

**`createDistillTask()` 修改：**

在创建 Knowledge 记录时，若 `prepareContent()` 返回了 `mediaMeta`，保存到 `Knowledge.mediaMeta` 字段：

```typescript
const knowledge = await prisma.knowledge.create({
  data: {
    userId,
    title,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    rawContent,
    mediaMeta: mediaMeta ?? null,  // 新增
    distilledData: {},
    status: "pending",
  },
});
```

**`processDistillTask()` 修改：**

PDF 分块蒸馏分支：检测 `knowledge.rawContent` 长度，若超过阈值则调用 `distillPdfInChunks()`，否则走现有单次蒸馏逻辑。

### 4.5 `POST /api/upload` — 文件上传端点

**请求：** `multipart/form-data`，字段 `file`

**限制：**
- 文件大小：≤ 20MB
- 文件类型：`.pdf` / `.txt` / `.md`

**处理流程：**
1. `auth()` 认证校验
2. 解析 multipart/form-data
3. 校验文件大小和扩展名
4. 创建目录 `apps/web/uploads/{userId}/`
5. 保存文件为 `{uuid}.{ext}`
6. 返回 `{ success: true, data: { filePath: "绝对路径", fileName: "原始文件名", size: "字节数" } }`

**实现方式：** 使用 Next.js 16 的 `Request.formData()` API（原生支持 multipart 解析，无需额外依赖）。

### 4.6 首页多 Tab UI

**Tab 结构：**

| Tab | 图标 | 输入组件 | 提交字段 |
|-----|------|---------|---------|
| 文本 | `FileText` | `Textarea` | `{sourceType: "text", content}` |
| 网页链接 | `Link` | `Input` (URL) | `{sourceType: "url", sourceUrl}` |
| PDF 文件 | `FileText` | `FileUpload` | `{sourceType: "pdf", filePath, useHybrid}` |
| 抖音视频 | `Video` | `LinkInput` | `{sourceType: "douyin", sourceUrl, cookie?}` |
| 小红书 | `Image` | `LinkInput` | `{sourceType: "xiaohongshu", sourceUrl, cookie?}` |

**`FileUpload` 组件：**
- 拖拽 + 点击两种方式选择文件
- 显示文件名、大小、删除按钮
- 上传中显示进度（使用 `XMLHttpRequest` 的 `progress` 事件）
- 上传完成返回 `filePath`，存入 state

**`LinkInput` 组件：**
- URL 输入框（必填）
- Cookie 输入框（选填，折叠展开）
- 自动识别：输入抖音链接显示"抖音视频"，输入小红书链接显示"小红书笔记"

**提交逻辑：**
- PDF Tab：先调 `POST /api/upload` 获取 `filePath`，再调 `POST /api/distill`
- 其他 Tab：直接调 `POST /api/distill`
- 轮询状态逻辑复用现有 `DistillProgress`（2 秒间隔）

---

## 5. 数据流详解

### 5.1 PDF 蒸馏完整流程

```
1. 用户在 PDF Tab 拖拽文件
2. FileUpload 组件 → POST /api/upload (multipart)
3. /api/upload 保存文件 → 返回 { filePath: "E:/.../uploads/{userId}/{uuid}.pdf" }
4. 用户点击"开始蒸馏"
5. 前端 → POST /api/distill { sourceType: "pdf", filePath, useHybrid: false }
6. /api/distill → createDistillTask(userId, input)
   → prepareContent(pdf) → extractPdf(filePath)
     → lib/media/client.ts → POST Python /pdf/extract-from-path
     → 返回 { markdown, pageCount, usedHybrid }
   → 创建 Knowledge { rawContent: markdown, status: "pending" }
   → 创建 DistillTask { status: "pending" }
   → 返回 { taskId, knowledgeId }
7. /api/distill → processDistillTask(taskId) [fire-and-forget]
   → 更新状态为 processing
   → 获取 AI Provider
   → 检测 rawContent 长度
     → 若 > 16000 字符：distillPdfInChunks() 分块蒸馏
     → 否则：单次蒸馏（现有逻辑）
   → 解析结果 → 更新 Knowledge { distilledData, status: "completed" }
   → 创建标签
   → 更新 DistillTask { status: "completed" }
8. 前端轮询 GET /api/distill/{taskId} → 展示结果
```

### 5.2 抖音蒸馏完整流程

```
1. 用户在抖音 Tab 输入链接
2. 前端 → POST /api/distill { sourceType: "douyin", sourceUrl: "https://v.douyin.com/xxx/" }
3. createDistillTask(userId, input)
   → prepareContent(douyin) → processDouyinVideo(url)
     → lib/media/client.ts → POST Python /media/douyin { url, task_id }
     → Python: yt-dlp 下载 → ffmpeg 分离音频 → Whisper ASR
     → 返回 { transcript, title, author, duration }
   → 创建 Knowledge { rawContent: transcript, mediaMeta: {platform:"douyin",...} }
4. processDistillTask(taskId)
   → AI 蒸馏 transcript → 更新 Knowledge
5. 前端轮询 → 展示结果（含媒体元数据）
```

### 5.3 小红书蒸馏完整流程

```
1. 用户在小红书 Tab 输入链接
2. 前端 → POST /api/distill { sourceType: "xiaohongshu", sourceUrl }
3. createDistillTask(userId, input)
   → prepareContent(xiaohongshu) → processXiaohongshuNote(url)
     → lib/media/client.ts → POST Python /media/xiaohongshu { url, task_id }
     → Python: BeautifulSoup 提取 → 若视频笔记则复用抖音流程
     → 返回 { noteType, title, content, transcript, author, tags, ... }
   → 创建 Knowledge {
       rawContent: title + content + (transcript?),
       mediaMeta: {platform:"xiaohongshu", noteType, author, tags, ...}
     }
4. processDistillTask(taskId)
   → AI 蒸馏 → 更新 Knowledge
5. 前端轮询 → 展示结果
```

---

## 6. 错误处理

| 场景 | 处理方式 | 用户感知 |
|------|---------|---------|
| Python 服务未启动 | `client.ts` 连接失败，抛出 `Error("无法连接媒体处理服务")` | 任务状态 failed，errorMessage 显示连接失败 |
| PDF 解析失败（损坏文件） | Python 返回 500，`client.ts` 抛出详情 | 任务 failed，errorMessage 透传 |
| 抖音视频下载失败（链接无效） | Python 返回 400/500，`client.ts` 抛出 | 任务 failed |
| 抖音视频超时长限制 | Python 返回 400 | 任务 failed，提示"视频时长超限" |
| 小红书视频 ASR 失败 | Python 内部降级（transcript=""），不影响主流程 | 任务成功，但无视频转写内容 |
| 文件上传超 20MB | `/api/upload` 返回 400 | 前端显示"文件大小超限" |
| 文件类型不支持 | `/api/upload` 返回 400 | 前端显示"仅支持 PDF/TXT/MD" |
| AI 蒸馏失败 | 现有逻辑不变 | 任务 failed |
| PDF 分块蒸馏部分失败 | `distillPdfInChunks` 捕获单块错误，跳过该块继续 | 任务成功，但可能缺失部分内容 |

---

## 7. 测试策略

### 7.1 手动测试

**前提：** 启动 Python 服务 + Next.js dev server

```bash
# 终端 1：Python 服务
cd services/media-processor
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 终端 2：Next.js
cd apps/web
pnpm dev
```

**测试用例：**

1. **PDF 蒸馏**：上传一个 PDF → 检查蒸馏结果是否包含摘要/关键点/大纲
2. **抖音蒸馏**：输入抖音分享链接 → 检查转写文本和媒体元数据
3. **小红书图文**：输入小红书图文笔记链接 → 检查内容提取
4. **小红书视频**：输入小红书视频笔记链接 → 检查视频转写
5. **错误场景**：Python 服务关闭时提交蒸馏 → 检查错误提示

### 7.2 TypeScript 检查

```bash
cd apps/web
pnpm typecheck
```

确保 0 错误。

---

## 8. 实现顺序

按方案 A（后端优先分层）：

1. **Step 1：基础设施**
   - 创建 `lib/config.ts`
   - 创建 `lib/media/client.ts`（3 个函数）

2. **Step 2：蒸馏服务改造**
   - 修改 `distill.service.ts` 的 `prepareContent()` 添加 3 个分支
   - 修改 `createDistillTask()` 保存 `mediaMeta`
   - 创建 `lib/extractor/pdf.ts` 分块蒸馏逻辑
   - 修改 `processDistillTask()` 支持分块

3. **Step 3：文件上传端点**
   - 创建 `POST /api/upload`

4. **Step 4：首页多 Tab UI**
   - 创建 `FileUpload` 组件
   - 创建 `LinkInput` 组件
   - 改造 `dashboard/page.tsx` 为多 Tab

5. **Step 5：测试验证**
   - TypeScript 检查
   - 手动测试 3 种媒体类型

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Python 服务跨域问题 | client.ts 无法调用 | Python 已配置 CORS `allow_origins=["*"]` |
| 大 PDF 超时 | AI 蒸馏超 2 分钟 | 分块蒸馏 + 单块超时 2 分钟 |
| 抖音反爬升级 | 下载失败 | 支持 Cookie 配置；错误提示友好 |
| 文件路径跨平台 | Windows/Linux 路径差异 | 使用 `path.join()` + 绝对路径 |
| uploads 目录权限 | 文件保存失败 | 启动时自动创建目录 `fs.mkdir({recursive: true})` |
