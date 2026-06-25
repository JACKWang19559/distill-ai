/**
 * 蒸馏服务 - 核心编排逻辑。
 *
 * 职责：
 * 1. createDistillTask：创建蒸馏任务（Knowledge + DistillTask 记录）
 * 2. processDistillTask：异步执行蒸馏流水线（提取 → AI 蒸馏 → 解析 → 入库）
 * 3. getDistillStatus：查询任务状态
 *
 * 支持的来源类型：
 * - text / markdown：直接使用 content 字段
 * - url：fetch 页面 + 基础 HTML 清洗
 * - pdf：调用 Python 媒体服务解析 PDF → Markdown
 * - douyin：调用 Python 媒体服务下载视频 + ASR 转写
 * - xiaohongshu：调用 Python 媒体服务提取笔记内容（图文/视频）
 */

import type { DistillInput, MediaMeta } from "@distill/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveProvider } from "@/lib/ai/factory";
import {
  DISTILL_SYSTEM_PROMPT,
  buildDistillUserPrompt,
  parseDistillResult,
} from "@/lib/ai/prompts";
import type { ChatMessage } from "@/lib/ai/types";
import type { DistillOutput } from "@/lib/ai/prompts";
import { extractPdf, processDouyinVideo, processXiaohongshuNote } from "@/lib/media/client";
import { distillPdfInChunks } from "@/lib/extractor/pdf";
import { createConnections } from "@/services/graph.service";
import { PDF_CHUNK_MAX_CHARS } from "@/lib/config";
import { getActiveAsrCredentials } from "@/lib/ai/factory";

/** 蒸馏任务创建结果 */
export interface CreateDistillTaskResult {
  /** 任务 ID */
  taskId: string;
  /** 知识条目 ID */
  knowledgeId: string;
}

/** 蒸馏状态查询结果 */
export interface DistillStatusResult {
  taskId: string;
  status: string;
  knowledgeId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建蒸馏任务。
 *
 * 1. 提取/准备原始内容
 * 2. 创建 Knowledge 记录（status=pending）
 * 3. 创建 DistillTask 记录（status=pending）
 *
 * @param userId 用户 ID
 * @param input 蒸馏输入
 * @returns 任务 ID 与知识条目 ID
 */
export async function createDistillTask(
  userId: string,
  input: DistillInput
): Promise<CreateDistillTaskResult> {
  // 1. 准备原始内容
  const { title, rawContent, mediaMeta } = await prepareContent(input, userId);

  // 2. 创建 Knowledge 记录
  const knowledge = await prisma.knowledge.create({
    data: {
      userId,
      title,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      rawContent,
      distilledData: {},
      status: "pending",
      // JSON.parse(JSON.stringify()) 确保 Prisma JSON 字段接受（去除接口修饰类型）
      mediaMeta: mediaMeta
        ? JSON.parse(JSON.stringify(mediaMeta))
        : Prisma.JsonNull,
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

/**
 * 异步处理蒸馏任务。
 *
 * 流水线：
 * 1. 更新状态为 processing
 * 2. 获取用户激活的 AI 供应商
 * 3. 构建蒸馏 Prompt
 * 4. 调用 AI（JSON 模式）
 * 5. 解析 + 校验结果
 * 6. 更新 Knowledge（标题、蒸馏结果、状态）
 * 7. 创建推荐标签
 * 8. 更新任务状态为 completed
 *
 * 任何步骤失败：更新状态为 failed 并记录错误信息。
 *
 * @param taskId 任务 ID
 */
export async function processDistillTask(taskId: string): Promise<void> {
  try {
    // 1. 查询任务与知识条目
    const task = await prisma.distillTask.findUnique({
      where: { id: taskId },
      include: { knowledge: true },
    });

    if (!task || !task.knowledge) {
      throw new Error(`任务或知识条目不存在: ${taskId}`);
    }

    const knowledge = task.knowledge;

    // 2. 更新状态为 processing
    await prisma.$transaction([
      prisma.distillTask.update({
        where: { id: taskId },
        data: { status: "processing" },
      }),
      prisma.knowledge.update({
        where: { id: knowledge.id },
        data: { status: "processing" },
      }),
    ]);

    // 3. 获取 AI 供应商
    const provider = await getActiveProvider(task.userId);

    // 4. 蒸馏：PDF 长内容分块蒸馏，其他类型单次蒸馏
    let distilled: DistillOutput;
    if (
      knowledge.sourceType === "pdf" &&
      knowledge.rawContent.length > PDF_CHUNK_MAX_CHARS
    ) {
      // PDF 内容过长，分块蒸馏后合并
      distilled = await distillPdfInChunks(knowledge.rawContent, provider);
    } else {
      // 单次蒸馏：构建消息 → 调用 AI（JSON 模式）→ 解析结果
      const messages: ChatMessage[] = [
        { role: "system", content: DISTILL_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildDistillUserPrompt(
            knowledge.title,
            knowledge.rawContent
          ),
        },
      ];

      // 调用 AI（JSON 模式，温度 0.3 保证稳定输出）
      const response = await provider.chat(messages, {
        temperature: 0.3,
        maxTokens: 4096,
        responseFormat: "json",
        timeoutMs: 120_000, // 蒸馏任务可能较长，2 分钟超时
      });

      // 解析 + 校验结果
      distilled = parseDistillResult(response.content);
    }

    // 5. 更新 Knowledge
    await prisma.knowledge.update({
      where: { id: knowledge.id },
      data: {
        title: distilled.title,
        // JSON.parse(JSON.stringify()) 确保 Prisma JSON 字段接受（去除 Zod 修饰类型）
        distilledData: JSON.parse(JSON.stringify(distilled)),
        status: "completed",
      },
    });

    // 6. 创建推荐标签
    await createTagsFromDistill(task.userId, knowledge.id, distilled);

    // 6.5 创建知识图谱关联（实体共现）
    // 失败不影响蒸馏主流程（createConnections 内部已 catch）
    await createConnections(knowledge.id, task.userId);

    // 7. 更新任务状态为 completed
    await prisma.distillTask.update({
      where: { id: taskId },
      data: { status: "completed" },
    });
  } catch (err) {
    // 失败处理：更新状态为 failed
    const errorMessage = err instanceof Error ? err.message : String(err);

    // 查询任务获取 knowledgeId
    const task = await prisma.distillTask
      .findUnique({ where: { id: taskId } })
      .catch(() => null);

    // 更新任务状态为 failed
    await prisma.distillTask
      .update({
        where: { id: taskId },
        data: { status: "failed", errorMessage },
      })
      .catch(() => {
        /* 忽略 */
      });

    // 更新知识条目状态为 failed
    if (task?.knowledgeId) {
      await prisma.knowledge
        .update({
          where: { id: task.knowledgeId },
          data: { status: "failed", errorMessage },
        })
        .catch(() => {
          /* 忽略 */
        });
    }

    // 不重新抛出：异步任务失败不应中断调用方
    console.error(`[DistillTask ${taskId}] 蒸馏失败:`, errorMessage);
  }
}

/**
 * 查询蒸馏任务状态。
 *
 * @param taskId 任务 ID
 * @param userId 用户 ID（用于权限校验）
 * @returns 任务状态信息
 * @throws 如果任务不存在或不属于该用户
 */
export async function getDistillStatus(
  taskId: string,
  userId: string
): Promise<DistillStatusResult> {
  const task = await prisma.distillTask.findFirst({
    where: { id: taskId, userId },
  });

  if (!task) {
    throw new Error(`任务不存在或无权访问: ${taskId}`);
  }

  return {
    taskId: task.id,
    status: task.status,
    knowledgeId: task.knowledgeId,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/**
 * 获取用户的蒸馏任务列表。
 *
 * @param userId 用户 ID
 * @param options 分页参数
 * @returns 任务列表
 */
export async function listDistillTasks(
  userId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{ tasks: DistillStatusResult[]; total: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;

  const [tasks, total] = await Promise.all([
    prisma.distillTask.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.distillTask.count({ where: { userId } }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      taskId: t.id,
      status: t.status,
      knowledgeId: t.knowledgeId,
      errorMessage: t.errorMessage,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    total,
  };
}

// ============================================================================
// 内部辅助函数
// ============================================================================

/**
 * 准备蒸馏内容：根据来源类型提取标题与原始内容。
 *
 * @param input 蒸馏输入
 * @param userId 用户 ID（用于读取用户 ASR 配置）
 * @returns 标题、原始内容，以及可选的媒体元数据
 */
async function prepareContent(
  input: DistillInput,
  userId: string
): Promise<{ title: string; rawContent: string; mediaMeta?: MediaMeta }> {
  switch (input.sourceType) {
    case "text":
    case "markdown": {
      if (!input.content) {
        throw new Error("text/markdown 来源必须提供 content 字段");
      }
      // 从内容前 50 字提取标题
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
      // 前端直传模式：媒体服务已解析为 Markdown，直接使用 content（绕过 Vercel 4.5MB 限制）
      if (input.content) {
        const pageCount = input.pageCount ?? 0;
        return {
          title: pageCount > 0 ? `PDF 文档（${pageCount} 页）` : "PDF 文档",
          rawContent: input.content,
        };
      }
      // 回退模式：filePath 由服务端读取并调用媒体服务解析（仅适用于 < 4.5MB 文件）
      if (!input.filePath) {
        throw new Error("pdf 来源必须提供 content 或 filePath 字段");
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
      // 读取用户配置的 ASR 凭证（未配置则返回 null，媒体服务 fallback 到环境变量）
      const asrCredentials = await getActiveAsrCredentials(userId);
      const result = await processDouyinVideo(
        input.sourceUrl,
        input.cookie,
        asrCredentials ?? undefined
      );
      const mediaMeta: MediaMeta = {
        platform: "douyin",
        author: result.author,
        duration: result.duration,
        videoTitle: result.title,
      };
      return {
        title: result.title,
        rawContent: result.transcript,
        mediaMeta,
      };
    }

    case "xiaohongshu": {
      if (!input.sourceUrl) {
        throw new Error("xiaohongshu 来源必须提供 sourceUrl 字段");
      }
      // 读取用户配置的 ASR 凭证
      const asrCredentials = await getActiveAsrCredentials(userId);
      const result = await processXiaohongshuNote(
        input.sourceUrl,
        input.cookie,
        asrCredentials ?? undefined
      );
      const mediaMeta: MediaMeta = {
        platform: "xiaohongshu",
        author: result.author,
        noteType: result.noteType,
        tags: result.tags,
        ipLocation: result.ipLocation,
        likedCount: result.likedCount,
        collectedCount: result.collectedCount,
        commentCount: result.commentCount,
      };
      // 图文笔记：仅 content；视频笔记：content + transcript
      const rawContent = result.transcript
        ? `${result.content}\n\n${result.transcript}`
        : result.content;
      return {
        title: result.title,
        rawContent,
        mediaMeta,
      };
    }

    default:
      throw new Error(`不支持的来源类型: ${input.sourceType}`);
  }
}

/**
 * 平台特殊处理：对 SPA 网站调用专用 API 获取内容。
 *
 * 某些网站（如今日头条）是纯 JavaScript 渲染的 SPA，
 * 服务端只返回空 HTML 壳，fetch 无法获取实际内容。
 * 此函数针对这些平台调用专用 API 获取文章内容。
 *
 * @returns 成功返回 { title, content }，不匹配返回 null（走通用抓取流程）
 */
async function fetchUrlByPlatform(
  url: string
): Promise<{ title: string; content: string } | null> {
  // 今日头条：www.toutiao.com/article/{id}/
  // 移动端 API：https://m.toutiao.com/i{id}/info/ 返回 JSON
  const toutiaoMatch = url.match(/toutiao\.com\/article\/(\d+)/);
  if (toutiaoMatch) {
    const articleId = toutiaoMatch[1];
    return fetchToutiaoContent(articleId, url);
  }

  return null;
}

/**
 * 抓取今日头条文章内容（通过移动端 API）。
 *
 * 今日头条网页版是 SPA，服务端返回空 HTML。
 * 移动端 API `https://m.toutiao.com/i{id}/info/` 返回 JSON，
 * 包含 `data.title` 和 `data.content`（HTML 格式）。
 */
async function fetchToutiaoContent(
  articleId: string,
  originalUrl: string
): Promise<{ title: string; content: string }> {
  const apiUrl = `https://m.toutiao.com/i${articleId}/info/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        // 使用移动端 UA，部分接口仅响应移动端请求
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: originalUrl,
      },
    });

    if (!res.ok) {
      throw new Error(`今日头条 API 返回 HTTP ${res.status}`);
    }

    const json = await res.json();
    const title = json?.data?.title || "今日头条文章";
    const htmlContent = json?.data?.content || "";

    if (!htmlContent) {
      throw new Error("今日头条 API 返回的内容为空");
    }

    // 将 HTML 内容转为纯文本
    const content = htmlContent
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!content || content.length < 10) {
      throw new Error("今日头条文章内容提取失败");
    }

    return { title, content };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("抓取今日头条文章超时（15 秒）");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 抓取 URL 内容并提取正文。
 *
 * 基础实现：fetch HTML → 去除 script/style/nav → 提取文本。
 * 后续可替换为 @mozilla/readability + jsdom 提升质量。
 */
async function fetchUrlContent(
  url: string
): Promise<{ title: string; content: string }> {
  // 平台特殊处理：某些网站是 SPA，服务端返回空 HTML，需要调用专用 API
  const platformResult = await fetchUrlByPlatform(url);
  if (platformResult) {
    return platformResult;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // 使用真实浏览器 UA，避免被网站反爬虫机制拒绝
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!res.ok) {
      throw new Error(`抓取失败: HTTP ${res.status}`);
    }

    // 检查 Content-Type，非 HTML 内容直接报错
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(
        `不支持的内容类型: ${contentType}（仅支持 HTML 网页）`
      );
    }

    const html = await res.text();

    if (!html || html.trim().length < 100) {
      throw new Error("页面内容为空或过短");
    }

    // 提取 <title>
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || url;

    // 优先提取正文区域（article/main/[role=main]），避免导航/侧边栏干扰
    let mainHtml = "";
    const mainPatterns = [
      /<article[\s\S]*?<\/article>/i,
      /<main[\s\S]*?<\/main>/i,
      /<div[^>]*role=["']main["'][\s\S]*?<\/div>/i,
      /<div[^>]*id=["']content["'][\s\S]*?<\/div>/i,
      /<div[^>]*class=["'][^"']*content[^"']*["'][\s\S]*?<\/div>/i,
    ];
    for (const pattern of mainPatterns) {
      const match = html.match(pattern);
      if (match && match[0].length > 500) {
        mainHtml = match[0];
        break;
      }
    }
    // 如果没有找到正文区域，使用整个 HTML
    const sourceHtml = mainHtml || html;

    // 基础 HTML 清洗：去除 script/style/nav/header/footer，提取文本
    const cleaned = sourceHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<form[\s\S]*?<\/form>/gi, "")
      // 块级元素换行
      .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // 去除所有标签
      .replace(/<[^>]+>/g, "")
      // HTML 实体解码
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&hellip;/g, "…")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      // 压缩空白
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // 限制内容长度（避免超出 LLM 上下文）
    const maxChars = 50_000;
    const content = cleaned.length > maxChars
      ? cleaned.slice(0, maxChars) + "\n\n[内容已截断]"
      : cleaned;

    if (!content || content.length < 10) {
      throw new Error("无法从页面提取正文内容（页面可能是 JavaScript 动态渲染）");
    }

    return { title, content };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("抓取 URL 超时（30 秒）");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从蒸馏结果创建标签并关联到知识条目。
 *
 * - 对每个推荐标签，查找或创建用户标签
 * - 创建 KnowledgeTag 关联
 */
async function createTagsFromDistill(
  userId: string,
  knowledgeId: string,
  distilled: DistillOutput
): Promise<void> {
  if (!distilled.suggestedTags || distilled.suggestedTags.length === 0) {
    return;
  }

  for (const tagName of distilled.suggestedTags) {
    // 查找或创建标签
    const tag = await prisma.tag.upsert({
      where: {
        userId_name: { userId, name: tagName },
      },
      update: {},
      create: {
        userId,
        name: tagName,
      },
    });

    // 关联到知识条目（忽略已存在的关联）
    await prisma.knowledgeTag
      .create({
        data: {
          knowledgeId,
          tagId: tag.id,
        },
      })
      .catch(() => {
        // 唯一约束冲突（已关联）→ 忽略
      });
  }
}
