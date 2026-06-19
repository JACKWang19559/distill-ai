# Phase 6 媒体蒸馏集成 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Next.js 端与 Python 媒体服务的集成，打通 PDF/抖音/小红书 3 种媒体类型的完整蒸馏链路，并提供统一多 Tab UI。

**Architecture:** 后端优先分层实现。先创建 Python 服务 HTTP 客户端（`lib/media/client.ts`），再改造 `distill.service.ts` 添加 3 个媒体分支，然后实现文件上传端点，最后改造首页为多 Tab UI。

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn/ui, FastAPI (Python 服务), opendataloader-pdf, yt-dlp, openai-whisper

**关联设计文档：** [2026-06-18-phase6-media-integration-design.md](./2026-06-18-phase6-media-integration-design.md)

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `apps/web/src/lib/config.ts` | 环境变量配置（MEDIA_SERVICE_URL、UPLOAD_DIR、MAX_UPLOAD_SIZE） |
| `apps/web/src/lib/media/client.ts` | Python 服务 HTTP 客户端（extractPdf、processDouyinVideo、processXiaohongshuNote） |
| `apps/web/src/lib/extractor/pdf.ts` | PDF 分块蒸馏逻辑（distillPdfInChunks） |
| `apps/web/src/app/api/upload/route.ts` | 文件上传端点 POST /api/upload |
| `apps/web/src/components/distill/file-upload.tsx` | PDF 拖拽上传组件 |
| `apps/web/src/components/distill/link-input.tsx` | 抖音/小红书链接输入组件 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `apps/web/src/services/distill.service.ts` | prepareContent() 添加 pdf/douyin/xiaohongshu 3 分支 + mediaMeta 保存 + PDF 分块蒸馏 |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | 多 Tab 改造（文本/URL/PDF/抖音/小红书） |

---

## Task 1: 创建环境变量配置 `lib/config.ts`

**Files:**
- Create: `apps/web/src/lib/config.ts`

- [ ] **Step 1: 创建配置文件**

创建 `apps/web/src/lib/config.ts`：

```typescript
/**
 * 应用配置 - 集中管理环境变量和常量。
 */

/** Python 媒体处理服务地址 */
export const MEDIA_SERVICE_URL =
  process.env.MEDIA_SERVICE_URL ?? "http://localhost:8001";

/** 文件上传目录（相对于 apps/web 项目根） */
export const UPLOAD_DIR = "uploads";

/** 最大上传文件大小（字节），默认 20MB */
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

/** 允许的上传文件扩展名 */
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".txt", ".md"];

/** PDF 蒸馏单块最大字符数（超过则分块） */
export const PDF_CHUNK_MAX_CHARS = 16_000;
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/config.ts
git commit -m "feat(config): 添加环境变量配置文件"
```

---

## Task 2: 创建 Python 服务客户端 `lib/media/client.ts`

**Files:**
- Create: `apps/web/src/lib/media/client.ts`

- [ ] **Step 1: 创建客户端文件**

创建 `apps/web/src/lib/media/client.ts`：

```typescript
/**
 * Python 媒体处理服务客户端。
 *
 * 封装对 services/media-processor 的 HTTP 调用，
 * 提供 PDF 解析、抖音视频处理、小红书笔记处理 3 个函数。
 */

import { MEDIA_SERVICE_URL } from "@/lib/config";

// ============================================================================
// 类型定义
// ============================================================================

/** PDF 解析结果 */
export interface PdfExtractResult {
  /** 提取的 Markdown 文本 */
  markdown: string;
  /** 页数 */
  pageCount: number;
  /** 输出格式 */
  format: string;
  /** 是否使用了 Hybrid 模式 */
  usedHybrid: boolean;
}

/** 抖音视频处理结果 */
export interface DouyinProcessResult {
  /** ASR 转写文本 */
  transcript: string;
  /** 视频标题 */
  title: string;
  /** 作者昵称 */
  author: string;
  /** 视频时长（秒） */
  duration: number;
  /** 音频文件 URL（仅 extract_audio_only 时返回） */
  audioUrl: string | null;
}

/** 小红书笔记处理结果 */
export interface XiaohongshuProcessResult {
  /** 笔记类型 */
  noteType: "image" | "video";
  /** 笔记标题 */
  title: string;
  /** 笔记正文 */
  content: string;
  /** 视频笔记的 ASR 转写文本（图文笔记为空） */
  transcript: string;
  /** 作者昵称 */
  author: string;
  /** 视频笔记的视频地址 */
  videoUrl: string | null;
  /** 标签列表 */
  tags: string[];
  /** IP 归属地 */
  ipLocation: string;
  /** 点赞数 */
  likedCount: string;
  /** 收藏数 */
  collectedCount: string;
  /** 评论数 */
  commentCount: string;
}

// ============================================================================
// 内部辅助
// ============================================================================

/**
 * 带超时的 fetch 请求。
 *
 * @param url 请求 URL
 * @param options fetch 选项
 * @param timeoutMs 超时毫秒
 * @throws Error 超时或 HTTP 非 2xx
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      // 尝试解析错误详情
      let detail = response.statusText;
      try {
        const errorBody = await response.json();
        detail = errorBody.detail ?? errorBody.message ?? detail;
      } catch {
        // JSON 解析失败，使用 statusText
      }
      throw new Error(`媒体服务错误 (HTTP ${response.status}): ${detail}`);
    }

    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`媒体服务请求超时（${timeoutMs / 1000}秒）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 公开 API
// ============================================================================

/**
 * PDF 解析（调用 Python /pdf/extract-from-path）。
 *
 * 使用服务端文件路径方式调用，避免二次上传。
 *
 * @param filePath PDF 文件的服务端绝对路径
 * @param useHybrid 是否启用 Hybrid 模式（扫描件/复杂表格）
 * @returns PDF 解析结果
 */
export async function extractPdf(
  filePath: string,
  useHybrid: boolean = false
): Promise<PdfExtractResult> {
  const formData = new FormData();
  formData.append("file_path", filePath);
  formData.append("use_hybrid", String(useHybrid));

  const response = await fetchWithTimeout(
    `${MEDIA_SERVICE_URL}/pdf/extract-from-path`,
    { method: "POST", body: formData },
    5 * 60 * 1000 // 5 分钟（大 PDF 解析慢）
  );

  const data = await response.json();
  return {
    markdown: data.markdown,
    pageCount: data.page_count,
    format: data.format,
    usedHybrid: data.used_hybrid,
  };
}

/**
 * 抖音视频处理（调用 Python /media/douyin）。
 *
 * 完整流程：下载视频 → 分离音频 → ASR 转写。
 *
 * @param url 抖音视频分享链接
 * @param cookie 可选 Cookie（反爬）
 * @returns 抖音视频处理结果
 */
export async function processDouyinVideo(
  url: string,
  cookie?: string
): Promise<DouyinProcessResult> {
  const taskId = crypto.randomUUID();

  const response = await fetchWithTimeout(
    `${MEDIA_SERVICE_URL}/media/douyin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, cookie, task_id: taskId }),
    },
    10 * 60 * 1000 // 10 分钟（下载 + ASR 耗时长）
  );

  const data = await response.json();
  return {
    transcript: data.transcript,
    title: data.title,
    author: data.author,
    duration: data.duration,
    audioUrl: data.audio_url,
  };
}

/**
 * 小红书笔记处理（调用 Python /media/xiaohongshu）。
 *
 * 图文笔记：直接返回文本内容。
 * 视频笔记：提取内容 + 下载视频 + ASR 转写。
 *
 * @param url 小红书笔记链接
 * @param cookie 可选 Cookie
 * @returns 小红书笔记处理结果
 */
export async function processXiaohongshuNote(
  url: string,
  cookie?: string
): Promise<XiaohongshuProcessResult> {
  const taskId = crypto.randomUUID();

  const response = await fetchWithTimeout(
    `${MEDIA_SERVICE_URL}/media/xiaohongshu`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, cookie, task_id: taskId }),
    },
    10 * 60 * 1000 // 10 分钟
  );

  const data = await response.json();
  return {
    noteType: data.note_type,
    title: data.title,
    content: data.content,
    transcript: data.transcript,
    author: data.author,
    videoUrl: data.video_url,
    tags: data.tags,
    ipLocation: data.ip_location,
    likedCount: data.liked_count,
    collectedCount: data.collected_count,
    commentCount: data.comment_count,
  };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/media/client.ts
git commit -m "feat(media): 添加 Python 媒体服务客户端"
```

---

## Task 3: 创建 PDF 分块蒸馏 `lib/extractor/pdf.ts`

**Files:**
- Create: `apps/web/src/lib/extractor/pdf.ts`

- [ ] **Step 1: 创建分块蒸馏文件**

创建 `apps/web/src/lib/extractor/pdf.ts`：

```typescript
/**
 * PDF 分块蒸馏模块。
 *
 * 当 PDF 解析出的 Markdown 内容过长时，
 * 分块调用 AI 蒸馏，最后合并结果。
 */

import type { AIProvider } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/ai/types";
import {
  DISTILL_SYSTEM_PROMPT,
  buildDistillUserPrompt,
  parseDistillResult,
} from "@/lib/ai/prompts";
import type { DistillOutput } from "@/lib/ai/prompts";
import { PDF_CHUNK_MAX_CHARS } from "@/lib/config";

/**
 * 将长文本按段落边界分块。
 *
 * 尽量在段落边界（\n\n）处切分，避免截断段落。
 *
 * @param text 原始文本
 * @param maxChars 单块最大字符数
 * @returns 分块数组
 */
function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  // 按段落分割
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    // 若当前块 + 新段落超限，且当前块非空，先保存当前块
    if (currentChunk.length + paragraph.length + 2 > maxChars && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    // 若单个段落超过 maxChars，硬切分
    if (paragraph.length > maxChars) {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
    } else {
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 蒸馏单个分块。
 *
 * @param provider AI 供应商
 * @param chunkContent 分块内容
 * @returns 蒸馏结果
 */
async function distillChunk(
  provider: AIProvider,
  chunkContent: string
): Promise<DistillOutput> {
  const messages: ChatMessage[] = [
    { role: "system", content: DISTILL_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildDistillUserPrompt("PDF 文档分块", chunkContent),
    },
  ];

  const response = await provider.chat(messages, {
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: "json",
    timeoutMs: 120_000,
  });

  return parseDistillResult(response.content);
}

/**
 * 合并多个分块的蒸馏结果。
 *
 * 合并策略：
 * - title: 取第一块的标题
 * - summary: 拼接各块 summary
 * - keyPoints: 合并去重，取前 7 个
 * - outline: 拼接各块 outline
 * - suggestedTags: 合并去重，取前 5 个
 * - entities: 合并去重
 *
 * @param results 各分块的蒸馏结果
 * @returns 合并后的蒸馏结果
 */
function mergeDistillResults(results: DistillOutput[]): DistillOutput {
  if (results.length === 0) {
    return {
      title: "PDF 文档",
      summary: "",
      keyPoints: [],
      outline: "",
      suggestedTags: [],
    };
  }

  const first = results[0];

  // 合并 keyPoints（去重）
  const allKeyPoints = results.flatMap((r) => r.keyPoints);
  const uniqueKeyPoints = [...new Set(allKeyPoints)].slice(0, 7);

  // 合并 suggestedTags（去重）
  const allTags = results.flatMap((r) => r.suggestedTags);
  const uniqueTags = [...new Set(allTags)].slice(0, 5);

  // 合并 entities（按 name 去重）
  const entityMap = new Map<string, { name: string; type: string }>();
  for (const r of results) {
    if (r.entities) {
      for (const e of r.entities) {
        if (!entityMap.has(e.name)) {
          entityMap.set(e.name, e);
        }
      }
    }
  }

  return {
    title: first.title,
    summary: results.map((r) => r.summary).join("\n\n"),
    keyPoints: uniqueKeyPoints,
    outline: results.map((r) => r.outline).join("\n\n---\n\n"),
    suggestedTags: uniqueTags,
    entities: entityMap.size > 0 ? Array.from(entityMap.values()) : undefined,
  };
}

/**
 * 分块蒸馏 PDF 内容。
 *
 * 若内容不超过 PDF_CHUNK_MAX_CHARS，直接单次蒸馏。
 * 否则分块蒸馏后合并结果。
 *
 * @param markdown PDF 解析出的 Markdown 内容
 * @param provider AI 供应商
 * @returns 蒸馏结果
 */
export async function distillPdfInChunks(
  markdown: string,
  provider: AIProvider
): Promise<DistillOutput> {
  // 内容不长，直接单次蒸馏
  if (markdown.length <= PDF_CHUNK_MAX_CHARS) {
    return distillChunk(provider, markdown);
  }

  // 分块蒸馏
  const chunks = splitIntoChunks(markdown, PDF_CHUNK_MAX_CHARS);
  console.log(`[PDF 分块蒸馏] 内容 ${markdown.length} 字符，分为 ${chunks.length} 块`);

  const results: DistillOutput[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[PDF 分块蒸馏] 正在蒸馏第 ${i + 1}/${chunks.length} 块...`);
    const result = await distillChunk(provider, chunks[i]);
    results.push(result);
  }

  return mergeDistillResults(results);
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/extractor/pdf.ts
git commit -m "feat(extractor): 添加 PDF 分块蒸馏模块"
```

---

## Task 4: 改造 `distill.service.ts` 添加媒体分支

**Files:**
- Modify: `apps/web/src/services/distill.service.ts`

- [ ] **Step 1: 修改 prepareContent 返回类型和分支**

在 `apps/web/src/services/distill.service.ts` 中：

1. 在文件顶部添加导入：

```typescript
import type { MediaMeta } from "@distill/shared";
import { extractPdf, processDouyinVideo, processXiaohongshuNote } from "@/lib/media/client";
import { distillPdfInChunks } from "@/lib/extractor/pdf";
import { PDF_CHUNK_MAX_CHARS } from "@/lib/config";
```

2. 修改 `prepareContent` 函数的返回类型和签名：

```typescript
/**
 * 准备蒸馏内容：根据来源类型提取标题与原始内容。
 */
async function prepareContent(
  input: DistillInput
): Promise<{ title: string; rawContent: string; mediaMeta?: MediaMeta }> {
  switch (input.sourceType) {
    case "text":
    case "markdown": {
      if (!input.content) {
        throw new Error("text/markdown 来源必须提供 content 字段");
      }
      const title = input.content.slice(0, 50).replace(/\n/g, " ").trim();
      return { title: title || "未命名内容", rawContent: input.content };
    }

    case "url": {
      if (!input.sourceUrl) {
        throw new Error("url 来源必须提供 sourceUrl 字段");
      }
      const { title, content } = await fetchUrlContent(input.sourceUrl);
      return { title, rawContent: content };
    }

    case "pdf": {
      if (!input.filePath) {
        throw new Error("pdf 来源必须提供 filePath 字段");
      }
      const result = await extractPdf(input.filePath, input.useHybrid);
      return {
        title: `PDF 文档（${result.pageCount} 页）`,
        rawContent: result.markdown,
      };
    }

    case "douyin": {
      if (!input.sourceUrl) {
        throw new Error("douyin 来源必须提供 sourceUrl 字段");
      }
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
      if (!input.sourceUrl) {
        throw new Error("xiaohongshu 来源必须提供 sourceUrl 字段");
      }
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

    default:
      throw new Error(`不支持的来源类型: ${input.sourceType}`);
  }
}
```

- [ ] **Step 2: 修改 createDistillTask 保存 mediaMeta**

在 `createDistillTask` 函数中，修改 Knowledge 创建逻辑：

```typescript
export async function createDistillTask(
  userId: string,
  input: DistillInput
): Promise<CreateDistillTaskResult> {
  // 1. 准备原始内容
  const { title, rawContent, mediaMeta } = await prepareContent(input);

  // 2. 创建 Knowledge 记录
  const knowledge = await prisma.knowledge.create({
    data: {
      userId,
      title,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      rawContent,
      mediaMeta: mediaMeta ?? null,
      distilledData: {},
      status: "pending",
    },
  });

  // 3. 创建 DistillTask 记录
  const task = await prisma.distillTask.create({
    data: {
      userId,
      knowledgeId: knowledge.id,
      status: "pending",
    },
  });

  return {
    taskId: task.id,
    knowledgeId: knowledge.id,
  };
}
```

- [ ] **Step 3: 修改 processDistillTask 支持 PDF 分块蒸馏**

在 `processDistillTask` 函数中，替换步骤 4-6（构建消息→调用AI→解析）为：

```typescript
    // 4. 获取 AI 供应商
    const provider = await getActiveProvider(task.userId);

    // 5. 蒸馏（PDF 大文件分块，其他单次）
    let distilled: DistillOutput;

    if (
      knowledge.sourceType === "pdf" &&
      knowledge.rawContent.length > PDF_CHUNK_MAX_CHARS
    ) {
      // PDF 分块蒸馏
      distilled = await distillPdfInChunks(knowledge.rawContent, provider);
    } else {
      // 单次蒸馏（text/markdown/url/小PDF/抖音/小红书）
      const messages: ChatMessage[] = [
        { role: "system", content: DISTILL_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildDistillUserPrompt(knowledge.title, knowledge.rawContent),
        },
      ];

      const response = await provider.chat(messages, {
        temperature: 0.3,
        maxTokens: 4096,
        responseFormat: "json",
        timeoutMs: 120_000,
      });

      distilled = parseDistillResult(response.content);
    }

    // 6. 更新 Knowledge
    await prisma.knowledge.update({
      where: { id: knowledge.id },
      data: {
        title: distilled.title,
        distilledData: JSON.parse(JSON.stringify(distilled)),
        status: "completed",
      },
    });
```

注意：删除原有的步骤 4-6 代码（构建消息→调用AI→解析→更新Knowledge），用上述代码替换。保留步骤 1-3（查询任务→更新状态processing→获取provider）和步骤 7-9（创建标签→更新任务completed）。

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/distill.service.ts
git commit -m "feat(distill): 添加 PDF/抖音/小红书蒸馏分支 + mediaMeta 保存"
```

---

## Task 5: 创建文件上传端点 `POST /api/upload`

**Files:**
- Create: `apps/web/src/app/api/upload/route.ts`

- [ ] **Step 1: 创建上传端点**

创建 `apps/web/src/app/api/upload/route.ts`：

```typescript
/**
 * 文件上传 API 端点。
 *
 * POST /api/upload
 * - multipart/form-data，字段名 file
 * - 限制：20MB，类型 .pdf/.txt/.md
 * - 保存到 uploads/{userId}/{uuid}.{ext}
 * - 返回 filePath 供 /api/distill 使用
 */

import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/config";
import {
  UPLOAD_DIR,
  MAX_UPLOAD_SIZE,
  ALLOWED_UPLOAD_EXTENSIONS,
} from "@/lib/config";

/**
 * 处理文件上传。
 *
 * 1. 认证校验
 * 2. 解析 multipart/form-data
 * 3. 校验文件大小和扩展名
 * 4. 保存到 uploads/{userId}/{uuid}.{ext}
 * 5. 返回文件路径
 */
export async function POST(request: Request) {
  try {
    // 1. 认证校验
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    // 2. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "未提供文件" },
        },
        { status: 400 }
      );
    }

    // 3. 校验文件大小
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: `文件大小超过限制（最大 ${MAX_UPLOAD_SIZE / 1024 / 1024}MB）`,
          },
        },
        { status: 400 }
      );
    }

    // 4. 校验文件扩展名
    const fileName = file.name || "unknown";
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: `不支持的文件类型: ${ext}，仅支持 ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // 5. 保存文件
    const userId = session.user.id;
    const uploadDir = path.join(process.cwd(), UPLOAD_DIR, userId);
    await fs.mkdir(uploadDir, { recursive: true });

    const savedName = `${randomUUID()}${ext}`;
    const savedPath = path.join(uploadDir, savedName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(savedPath, Buffer.from(arrayBuffer));

    console.log(`[Upload] 用户 ${userId} 上传文件: ${fileName} → ${savedPath}`);

    // 6. 返回文件路径
    return NextResponse.json(
      {
        success: true,
        data: {
          filePath: savedPath,
          fileName: fileName,
          size: file.size,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("文件上传失败:", error);
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/upload/route.ts
git commit -m "feat(upload): 添加文件上传端点 POST /api/upload"
```

---

## Task 6: 创建 FileUpload 组件

**Files:**
- Create: `apps/web/src/components/distill/file-upload.tsx`

- [ ] **Step 1: 创建 FileUpload 组件**

创建 `apps/web/src/components/distill/file-upload.tsx`：

```typescript
/**
 * 文件上传组件。
 *
 * 支持拖拽和点击两种方式选择文件。
 * 上传到 /api/upload，返回 filePath。
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { UploadCloud, File as FileIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 上传文件状态 */
type UploadState = "idle" | "uploading" | "success" | "error";

/** 已上传文件信息 */
export interface UploadedFile {
  /** 服务端文件路径 */
  filePath: string;
  /** 原始文件名 */
  fileName: string;
  /** 文件大小（字节） */
  size: number;
}

interface FileUploadProps {
  /** 上传完成回调 */
  onUploaded: (file: UploadedFile) => void;
  /** 清除回调 */
  onClear?: () => void;
  /** 接受的文件类型 */
  accept?: string;
  /** 最大文件大小（字节） */
  maxSize?: number;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUpload({
  onUploaded,
  onClear,
  accept = ".pdf,.txt,.md",
  maxSize = 20 * 1024 * 1024,
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  /** 上传文件 */
  const uploadFile = useCallback(
    (file: File) => {
      // 校验大小
      if (file.size > maxSize) {
        setError(`文件大小超过限制（最大 ${formatSize(maxSize)}）`);
        setState("error");
        return;
      }

      setState("uploading");
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      // 进度监听
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      // 完成监听
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            const uploaded: UploadedFile = response.data;
            setUploadedFile(uploaded);
            setState("success");
            onUploaded(uploaded);
          } else {
            setError(response.error?.message ?? "上传失败");
            setState("error");
          }
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            setError(response.error?.message ?? `上传失败 (HTTP ${xhr.status})`);
          } catch {
            setError(`上传失败 (HTTP ${xhr.status})`);
          }
          setState("error");
        }
      });

      // 错误监听
      xhr.addEventListener("error", () => {
        setError("网络错误，上传失败");
        setState("error");
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    },
    [maxSize, onUploaded]
  );

  /** 处理文件选择 */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  /** 处理拖拽 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  /** 处理拖拽悬停 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  /** 清除已上传文件 */
  const handleClear = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setUploadedFile(null);
    setState("idle");
    setError(null);
    setProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onClear?.();
  };

  // 已上传成功：显示文件信息
  if (state === "success" && uploadedFile) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
        <FileIcon className="h-8 w-8 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-green-900">
            {uploadedFile.fileName}
          </p>
          <p className="text-xs text-green-600">{formatSize(uploadedFile.size)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // 上传中 / 空闲：显示拖拽区域
  return (
    <div>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
          state === "uploading"
            ? "border-blue-300 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100",
          state === "error" && "border-red-300 bg-red-50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {state === "uploading" ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-blue-600">上传中... {progress}%</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              点击或拖拽文件到此处上传
            </p>
            <p className="text-xs text-gray-400">
              支持 PDF / TXT / MD，最大 {formatSize(maxSize)}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/distill/file-upload.tsx
git commit -m "feat(ui): 添加 FileUpload 拖拽上传组件"
```

---

## Task 7: 创建 LinkInput 组件

**Files:**
- Create: `apps/web/src/components/distill/link-input.tsx`

- [ ] **Step 1: 创建 LinkInput 组件**

创建 `apps/web/src/components/distill/link-input.tsx`：

```typescript
/**
 * 链接输入组件（抖音/小红书）。
 *
 * 提供 URL 输入框 + 可选 Cookie 输入。
 */

"use client";

import { useState } from "react";
import { Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface LinkInputProps {
  /** 链接类型标识（用于显示） */
  label: string;
  /** 占位符 */
  placeholder?: string;
  /** URL 变化回调 */
  onUrlChange: (url: string) => void;
  /** Cookie 变化回调 */
  onCookieChange?: (cookie: string) => void;
  /** URL 值 */
  url: string;
  /** Cookie 值 */
  cookie?: string;
}

export function LinkInput({
  label,
  placeholder = "请输入链接",
  onUrlChange,
  onCookieChange,
  url,
  cookie = "",
}: LinkInputProps) {
  const [showCookie, setShowCookie] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          {label}
        </Label>
        <Input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-gray-500"
        onClick={() => setShowCookie(!showCookie)}
      >
        {showCookie ? (
          <ChevronUp className="mr-1 h-3 w-3" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3" />
        )}
        {showCookie ? "收起 Cookie" : "展开 Cookie（可选，用于反爬）"}
      </Button>

      {showCookie && onCookieChange && (
        <div className="space-y-2">
          <Label htmlFor="cookie" className="text-xs text-gray-500">
            Cookie
          </Label>
          <Textarea
            id="cookie"
            value={cookie}
            onChange={(e) => onCookieChange(e.target.value)}
            placeholder="粘贴浏览器 Cookie（可选）"
            className="min-h-[80px] text-xs"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/distill/link-input.tsx
git commit -m "feat(ui): 添加 LinkInput 链接输入组件"
```

---

## Task 8: 改造首页为多 Tab UI

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: 读取当前首页完整内容**

Run: Read `apps/web/src/app/(dashboard)/dashboard/page.tsx` 完整内容，理解现有结构（InputMode、DistillState、handleSubmit、轮询逻辑、结果展示）。

- [ ] **Step 2: 改造为多 Tab 结构**

修改 `apps/web/src/app/(dashboard)/dashboard/page.tsx`：

1. 添加导入：

```typescript
import { FileText, Link as LinkIcon, Video, Image as ImageIcon, File as FilePdf } from "lucide-react";
import { FileUpload, type UploadedFile } from "@/components/distill/file-upload";
import { LinkInput } from "@/components/distill/link-input";
```

2. 修改 InputMode 类型为 5 种：

```typescript
type InputMode = "text" | "url" | "pdf" | "douyin" | "xiaohongshu";
```

3. 添加 Tab 配置常量（在组件外）：

```typescript
/** Tab 配置 */
const TABS: Array<{
  mode: InputMode;
  label: string;
  icon: typeof FileText;
}> = [
  { mode: "text", label: "文本", icon: FileText },
  { mode: "url", label: "网页", icon: LinkIcon },
  { mode: "pdf", label: "PDF", icon: FilePdf },
  { mode: "douyin", label: "抖音", icon: Video },
  { mode: "xiaohongshu", label: "小红书", icon: ImageIcon },
];
```

4. 在组件内添加新的 state：

```typescript
const [pdfFilePath, setPdfFilePath] = useState<string | null>(null);
const [useHybrid, setUseHybrid] = useState(false);
const [douyinUrl, setDouyinUrl] = useState("");
const [douyinCookie, setDouyinCookie] = useState("");
const [xhsUrl, setXhsUrl] = useState("");
const [xhsCookie, setXhsCookie] = useState("");
```

5. 修改 handleSubmit 函数，根据 mode 构建不同的请求体：

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setState("submitting");
  setError(null);
  setResult(null);

  try {
    // 根据模式构建请求体
    let body: Record<string, unknown>;

    switch (mode) {
      case "text":
        if (!content.trim()) throw new Error("请输入文本内容");
        body = { sourceType: "text", content };
        break;
      case "url":
        if (!url.trim()) throw new Error("请输入网页链接");
        body = { sourceType: "url", sourceUrl: url };
        break;
      case "pdf":
        if (!pdfFilePath) throw new Error("请先上传 PDF 文件");
        body = { sourceType: "pdf", filePath: pdfFilePath, useHybrid };
        break;
      case "douyin":
        if (!douyinUrl.trim()) throw new Error("请输入抖音视频链接");
        body = {
          sourceType: "douyin",
          sourceUrl: douyinUrl,
          ...(douyinCookie ? { cookie: douyinCookie } : {}),
        };
        break;
      case "xiaohongshu":
        if (!xhsUrl.trim()) throw new Error("请输入小红书笔记链接");
        body = {
          sourceType: "xiaohongshu",
          sourceUrl: xhsUrl,
          ...(xhsCookie ? { cookie: xhsCookie } : {}),
        };
        break;
    }

    // 调用蒸馏 API
    const res = await fetch("/api/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error?.message ?? "提交失败");
    }

    setTaskId(data.data.taskId);
    setState("processing");
    // 开始轮询
    pollStatus(data.data.taskId);
  } catch (err) {
    setError(err instanceof Error ? err.message : "提交失败");
    setState("failed");
  }
};
```

6. 在 JSX 中替换原有的模式切换按钮和输入区域为 Tab 结构：

```tsx
{/* Tab 切换 */}
<div className="flex flex-wrap gap-2 border-b pb-3">
  {TABS.map((tab) => {
    const Icon = tab.icon;
    return (
      <button
        key={tab.mode}
        type="button"
        onClick={() => setMode(tab.mode)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
          mode === tab.mode
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Icon className="h-4 w-4" />
        {tab.label}
      </button>
    );
  })}
</div>

{/* 输入区域（根据 mode 显示不同内容） */}
<div className="space-y-4">
  {mode === "text" && (
    <div className="space-y-2">
      <Label htmlFor="content">文本内容</Label>
      <Textarea
        id="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="粘贴或输入要蒸馏的文本内容..."
        className="min-h-[200px]"
      />
    </div>
  )}

  {mode === "url" && (
    <div className="space-y-2">
      <Label htmlFor="url">网页链接</Label>
      <Input
        id="url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/article"
      />
    </div>
  )}

  {mode === "pdf" && (
    <div className="space-y-3">
      <Label>PDF 文件</Label>
      <FileUpload
        accept=".pdf"
        onUploaded={(file) => setPdfFilePath(file.filePath)}
        onClear={() => setPdfFilePath(null)}
      />
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={useHybrid}
          onChange={(e) => setUseHybrid(e.target.checked)}
        />
        启用 Hybrid 模式（扫描件/复杂表格，解析更慢但更准确）
      </label>
    </div>
  )}

  {mode === "douyin" && (
    <LinkInput
      label="抖音视频链接"
      placeholder="https://v.douyin.com/xxx/"
      url={douyinUrl}
      cookie={douyinCookie}
      onUrlChange={setDouyinUrl}
      onCookieChange={setDouyinCookie}
    />
  )}

  {mode === "xiaohongshu" && (
    <LinkInput
      label="小红书笔记链接"
      placeholder="https://www.xiaohongshu.com/explore/xxx"
      url={xhsUrl}
      cookie={xhsCookie}
      onUrlChange={setXhsUrl}
      onCookieChange={setXhsCookie}
    />
  )}
</div>
```

注意：保留现有的提交按钮、进度展示、结果展示、错误展示逻辑不变。

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): 首页改造为多 Tab 蒸馏入口"
```

---

## Task 9: 集成测试与验证

**Files:**
- 无文件修改，仅测试验证

- [ ] **Step 1: 启动 Python 媒体服务**

```bash
cd services/media-processor
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

验证：访问 `http://localhost:8001/health` 返回 200

- [ ] **Step 2: 启动 Next.js dev server**

```bash
cd apps/web
pnpm dev
```

验证：访问 `http://localhost:3000` 正常加载

- [ ] **Step 3: 测试文本蒸馏（回归测试）**

在首页"文本"Tab 输入一段文本 → 提交 → 验证蒸馏结果正常显示

- [ ] **Step 4: 测试 PDF 蒸馏**

1. 在首页切换到"PDF"Tab
2. 上传一个 PDF 文件 → 验证上传成功显示文件名
3. 点击"开始蒸馏" → 验证进度轮询 → 验证蒸馏结果

- [ ] **Step 5: 测试抖音蒸馏**

1. 在首页切换到"抖音"Tab
2. 输入抖音分享链接
3. 点击"开始蒸馏" → 验证进度轮询 → 验证蒸馏结果

- [ ] **Step 6: 测试小红书蒸馏**

1. 在首页切换到"小红书"Tab
2. 输入小红书笔记链接
3. 点击"开始蒸馏" → 验证进度轮询 → 验证蒸馏结果

- [ ] **Step 7: 测试错误场景**

1. 停止 Python 服务
2. 提交抖音蒸馏 → 验证错误提示"无法连接媒体处理服务"
3. 重启 Python 服务

- [ ] **Step 8: 最终 TypeScript 检查**

Run: `cd apps/web && pnpm typecheck`
Expected: 0 errors

- [ ] **Step 9: 更新 tasks.md 标记完成**

修改 `.trae/specs/ai-knowledge-distillation/tasks.md`，将以下任务标记为 `[x]`：
- Task 6.1: 实现文件上传
- Task 6.3: 实现 Next.js 端 PDF 蒸馏
- Task 6.8: 实现 Next.js 端抖音蒸馏集成
- Task 6.11: 实现 Next.js 端小红书蒸馏集成
- Task 6.12: 实现统一蒸馏入口 UI

更新进度总览表 Phase 6 行为 `12/14`（6.13/6.14 延后）。

- [ ] **Step 10: Commit**

```bash
git add .trae/specs/ai-knowledge-distillation/tasks.md
git commit -m "docs: Phase 6 核心集成完成，更新 tasks.md"
```

---

## 自审清单

### 1. Spec 覆盖检查

| Spec 章节 | 对应 Task | 状态 |
|-----------|----------|------|
| 4.1 lib/config.ts | Task 1 | ✅ |
| 4.2 lib/media/client.ts | Task 2 | ✅ |
| 4.3 lib/extractor/pdf.ts | Task 3 | ✅ |
| 4.4 distill.service.ts 改造 | Task 4 | ✅ |
| 4.5 POST /api/upload | Task 5 | ✅ |
| 4.6 首页多 Tab UI - FileUpload | Task 6 | ✅ |
| 4.6 首页多 Tab UI - LinkInput | Task 7 | ✅ |
| 4.6 首页多 Tab UI - dashboard 改造 | Task 8 | ✅ |
| 7. 测试策略 | Task 9 | ✅ |

### 2. 占位符扫描

✅ 无 TBD/TODO/"implement later"/"add appropriate error handling" 等占位符

### 3. 类型一致性检查

- `PdfExtractResult` 在 Task 2 定义，Task 4 使用 ✅
- `DouyinProcessResult` 在 Task 2 定义，Task 4 使用 ✅
- `XiaohongshuProcessResult` 在 Task 2 定义，Task 4 使用 ✅
- `UploadedFile` 在 Task 6 定义并导出，Task 8 使用 ✅
- `MediaMeta` 从 `@distill/shared` 导入，Task 4 使用 ✅
- `DistillOutput` 从 `@/lib/ai/prompts` 导入，Task 3/4 使用 ✅
- `AIProvider` 从 `@/lib/ai/provider` 导入，Task 3 使用 ✅

---

## 执行选择

Plan complete and saved to `.trae/specs/ai-knowledge-distillation/2026-06-18-phase6-media-integration-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - 每个 Task 分派独立 subagent，任务间审查，快速迭代

**2. Inline Execution** - 在当前会话中按顺序执行，批量执行 + 检查点审查

Which approach?
