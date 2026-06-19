/**
 * AI 供应商统一类型定义。
 *
 * 所有供应商适配器（OpenAI / Anthropic / Qwen / DeepSeek / Zhipu）
 * 共享这些类型，保证接口一致、可替换。
 */

/** 消息角色 */
export type ChatRole = "system" | "user" | "assistant";

/** 聊天消息 */
export interface ChatMessage {
  /** 消息角色 */
  role: ChatRole;
  /** 消息内容 */
  content: string;
}

/** 响应格式 */
export type ResponseFormat = "text" | "json";

/** 聊天调用选项 */
export interface ChatOptions {
  /** 采样温度（0-2，越高越随机） */
  temperature?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 模型名称（覆盖默认模型） */
  model?: string;
  /** 响应格式（text 或 json） */
  responseFormat?: ResponseFormat;
  /** 请求超时（毫秒），默认 60_000 */
  timeoutMs?: number;
}

/** Token 使用量 */
export interface TokenUsage {
  /** 提示 token 数 */
  promptTokens: number;
  /** 生成 token 数 */
  completionTokens: number;
  /** 总 token 数 */
  totalTokens: number;
}

/** 聊天响应 */
export interface ChatResponse {
  /** 生成的内容 */
  content: string;
  /** Token 使用量 */
  usage: TokenUsage;
  /** 实际使用的模型名 */
  model: string;
  /** 供应商原始响应（调试用，可选） */
  raw?: unknown;
}

/** 流式聊天块 */
export interface ChatChunk {
  /** 增量内容 */
  delta: string;
  /** 是否结束 */
  done: boolean;
  /** 结束时的 usage（仅 done=true 时存在） */
  usage?: TokenUsage;
}

/** 供应商配置 */
export interface ProviderConfig {
  /** API Key */
  apiKey: string;
  /** 默认模型名 */
  model: string;
  /** 自定义 API 地址（可选，用于代理或兼容接口） */
  baseUrl?: string;
}

/** AI 供应商错误 */
export class AIProviderError extends Error {
  /** HTTP 状态码（如有） */
  readonly statusCode?: number;
  /** 供应商名称 */
  readonly provider: string;
  /** 原始错误（如有） */
  readonly cause?: unknown;

  constructor(
    provider: string,
    message: string,
    options?: { statusCode?: number; cause?: unknown }
  ) {
    super(`[${provider}] ${message}`);
    this.name = "AIProviderError";
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;
  }
}
