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

/** ASR 凭证（从用户配置读取，通过 header 传给媒体服务） */
export interface AsrCredentials {
  /** ASR 供应商（groq/openai） */
  provider: string;
  /** API Key（已解密） */
  apiKey: string;
  /** API URL */
  apiUrl?: string;
  /** 模型名 */
  model?: string;
}

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
 * 构建 ASR 凭证 headers。
 *
 * 将用户配置的 ASR 凭证通过 HTTP header 传给媒体服务。
 * 媒体服务优先使用 header 凭证，fallback 到环境变量。
 *
 * @param asrCredentials ASR 凭证（可选）
 * @returns headers 对象（无凭证时为空对象）
 */
function buildAsrHeaders(asrCredentials?: AsrCredentials): Record<string, string> {
  if (!asrCredentials) {
    return {};
  }
  const headers: Record<string, string> = {
    "X-ASR-Api-Key": asrCredentials.apiKey,
    "X-ASR-Provider": asrCredentials.provider,
  };
  if (asrCredentials.apiUrl) {
    headers["X-ASR-Api-Url"] = asrCredentials.apiUrl;
  }
  if (asrCredentials.model) {
    headers["X-ASR-Model"] = asrCredentials.model;
  }
  return headers;
}

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
 * PDF 解析（调用 Python /pdf/extract）。
 *
 * 分离部署后文件系统不共享，改为上传文件流方式。
 * Next.js 读取本地文件 → 以 multipart/form-data 上传到媒体服务。
 *
 * @param filePath PDF 文件的服务端绝对路径（Next.js 端可访问）
 * @param useHybrid 是否启用 Hybrid 模式（扫描件/复杂表格）
 * @returns PDF 解析结果
 */
export async function extractPdf(
  filePath: string,
  useHybrid: boolean = false
): Promise<PdfExtractResult> {
  // 读取文件并构造上传请求
  const fs = await import("fs/promises");
  const path = await import("path");

  const fileBuffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, fileName);
  formData.append("use_hybrid", String(useHybrid));

  const response = await fetchWithTimeout(
    `${MEDIA_SERVICE_URL}/pdf/extract`,
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
 * @param asrCredentials 可选 ASR 凭证（用户自带 Key，通过 header 传递）
 * @returns 抖音视频处理结果
 */
export async function processDouyinVideo(
  url: string,
  cookie?: string,
  asrCredentials?: AsrCredentials
): Promise<DouyinProcessResult> {
  const taskId = crypto.randomUUID();
  const asrHeaders = buildAsrHeaders(asrCredentials);

  const response = await fetchWithTimeout(
    `${MEDIA_SERVICE_URL}/media/douyin`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...asrHeaders },
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
 * @param asrCredentials 可选 ASR 凭证（用户自带 Key，通过 header 传递）
 * @returns 小红书笔记处理结果
 */
export async function processXiaohongshuNote(
  url: string,
  cookie?: string,
  asrCredentials?: AsrCredentials
): Promise<XiaohongshuProcessResult> {
  const taskId = crypto.randomUUID();
  const asrHeaders = buildAsrHeaders(asrCredentials);

  const response = await fetchWithTimeout(
    `${MEDIA_SERVICE_URL}/media/xiaohongshu`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...asrHeaders },
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
