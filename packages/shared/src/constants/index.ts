/**
 * 常量定义。
 */

import type { SourceType, AIProviderType } from "../types";

/** 来源类型显示名称映射 */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  text: "文本",
  markdown: "Markdown",
  url: "网页",
  pdf: "PDF",
  douyin: "抖音视频",
  xiaohongshu: "小红书",
};

/** 来源类型图标名称（lucide-react） */
export const SOURCE_TYPE_ICONS: Record<SourceType, string> = {
  text: "FileText",
  markdown: "FileCode",
  url: "Globe",
  pdf: "FileText",
  douyin: "Video",
  xiaohongshu: "BookOpen",
};

/** 来源类型颜色（Tailwind 类名） */
export const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  text: "bg-blue-100 text-blue-700",
  markdown: "bg-purple-100 text-purple-700",
  url: "bg-green-100 text-green-700",
  pdf: "bg-red-100 text-red-700",
  douyin: "bg-pink-100 text-pink-700",
  xiaohongshu: "bg-orange-100 text-orange-700",
};

/** AI 供应商显示名称 */
export const AI_PROVIDER_LABELS: Record<AIProviderType, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  qwen: "通义千问",
  deepseek: "DeepSeek",
  zhipu: "智谱 GLM",
  minimax: "Minimax",
};

/** AI 供应商默认模型 */
export const AI_PROVIDER_DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  qwen: "qwen-max",
  deepseek: "deepseek-chat",
  zhipu: "glm-4-plus",
  minimax: "MiniMax-Text-01",
};

/** AI 供应商默认 API 地址 */
export const AI_PROVIDER_BASE_URLS: Record<AIProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  minimax: "https://api.minimaxi.com/v1",
};

/** 蒸馏阶段显示名称 */
export const DISTILL_STAGE_LABELS: Record<string, string> = {
  queued: "排队中",
  extracting: "提取内容中",
  downloading: "下载视频中",
  separating_audio: "分离音频中",
  transcribing: "语音识别中",
  distilling: "AI 蒸馏中",
  saving: "保存中",
  completed: "已完成",
  failed: "失败",
};

/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 最大分页大小 */
export const MAX_PAGE_SIZE = 100;

/** 最大文件上传大小（字节） */
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/** 允许的文件类型 */
export const ALLOWED_FILE_TYPES = [".pdf", ".txt", ".md"];

/** 最大视频时长（秒） */
export const MAX_VIDEO_DURATION = 1800; // 30 分钟
