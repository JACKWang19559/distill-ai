/**
 * 插件内部消息类型定义。
 *
 * 用于 background ↔ content script ↔ side panel 之间的通信。
 */

/** 页面内容提取结果 */
export interface PageContent {
  /** 页面标题 */
  title: string;
  /** 正文内容（Markdown 或纯文本） */
  content: string;
  /** 原始 HTML（可选，用于预览） */
  html?: string;
  /** 页面 URL */
  url: string;
  /** 作者 */
  author?: string;
  /** 发布时间（ISO 字符串） */
  publishedTime?: string;
  /** 字数 */
  wordCount: number;
  /** 预计阅读时间（分钟） */
  readingTime: number;
  /** 内容来源：整页、选区或智能识别 */
  source: "page" | "selection" | "smart";
  /** 站点名称 */
  siteName?: string;
  /** 提取的图片 URL 列表 */
  images?: string[];
  /** 提取的视频 URL 列表 */
  videos?: string[];
}

/** 插件消息类型 */
export type ExtensionMessage =
  | { type: "EXTRACT_PAGE"; source: "page" | "selection" | "smart" }
  | { type: "EXTRACT_RESULT"; data: PageContent | null; error?: string }
  | { type: "OPEN_SIDEPANEL" }
  | { type: "GET_CURRENT_TAB_CONTENT"; source?: "page" | "selection" | "smart" }
  | { type: "DISTILL_CONTENT"; content: PageContent }
  | { type: "LOGIN_SUCCESS"; token: string }
  | { type: "DISTILL_SELECTION"; tabId: number };

/** 蒸馏任务状态 */
export type DistillStatus = "pending" | "processing" | "completed" | "failed";

/** 蒸馏结果数据 */
export interface DistillResult {
  taskId: string;
  knowledgeId: string;
  status: DistillStatus;
  knowledge?: {
    id: string;
    title: string;
    sourceType: string;
    sourceUrl: string | null;
    distilledData: {
      summary?: string;
      keyPoints?: string[];
      /** Markdown 格式的层级大纲字符串 */
      outline?: string;
      suggestedTags?: string[];
      entities?: Array<{ name: string; type: string }>;
    };
    status: string;
    mediaMeta?: unknown;
    createdAt: string;
    tags?: Array<{ id: string; name: string; color?: string | null }>;
  };
}
