/**
 * AI 供应商模块统一出口。
 *
 * 使用方式：
 * ```ts
 * import { OpenAIProvider, type AIProvider } from "@/lib/ai";
 * ```
 */

// 类型
export type {
  ChatRole,
  ChatMessage,
  ResponseFormat,
  ChatOptions,
  TokenUsage,
  ChatResponse,
  ChatChunk,
  ProviderConfig,
} from "./types";

export { AIProviderError } from "./types";

// 接口与基类
export type { AIProvider } from "./provider";
export { BaseAIProvider } from "./provider";

// 供应商适配器
export { OpenAIProvider } from "./openai";
export { AnthropicProvider } from "./anthropic";
export { QwenProvider } from "./qwen";
export { DeepSeekProvider } from "./deepseek";
export { ZhipuProvider } from "./zhipu";

// 工厂与路由
export { AIProviderFactory, getActiveProvider, listUserApiConfigs, isValidProviderType } from "./factory";

// 蒸馏 Prompt 与 Schema
export {
  DISTILL_SYSTEM_PROMPT,
  buildDistillUserPrompt,
  distillResultSchema,
  parseDistillResult,
  entitySchema,
  entityTypeSchema,
} from "./prompts";
export type { DistillOutput } from "./prompts";
