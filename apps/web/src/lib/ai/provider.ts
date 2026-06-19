/**
 * AI 供应商统一接口。
 *
 * 所有供应商适配器必须实现此接口。
 * 通过工厂模式（factory.ts）注册与创建，业务层只依赖此接口，
 * 不感知具体供应商差异。
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ProviderConfig,
} from "./types";

/**
 * AI 供应商统一接口。
 *
 * 实现方需保证：
 * 1. `chat()` 返回完整响应（含 usage）
 * 2. `streamChat()` 为异步迭代器，逐块返回 delta；最后一块 `done=true` 且携带 usage
 * 3. 错误抛出 `AIProviderError`，便于上层统一处理
 */
export interface AIProvider {
  /** 供应商唯一名称（openai / anthropic / qwen / deepseek / zhipu） */
  readonly name: string;

  /** 默认模型名 */
  readonly defaultModel: string;

  /**
   * 同步聊天：等待完整响应后返回。
   *
   * @param messages 消息列表（至少包含一条 user 消息）
   * @param options  聊天选项（温度、最大 token、响应格式等）
   * @returns 完整聊天响应（含 content、usage、model）
   * @throws {AIProviderError} 调用失败时抛出
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * 流式聊天：逐块返回内容，适合实时展示。
   *
   * @param messages 消息列表
   * @param options  聊天选项
   * @returns 异步迭代器，每次 yield 一个 ChatChunk
   * @throws {AIProviderError} 调用失败时抛出
   */
  streamChat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<ChatChunk>;
}

/**
 * 供应商适配器抽象基类。
 *
 * 提供通用能力：
 * - 构造时保存 config
 * - 提供 `resolveModel(options)` 解析最终使用的模型
 * - 提供 `buildHeaders()` 默认实现（子类可覆盖）
 *
 * 子类只需实现 `chat()` 与 `streamChat()`。
 */
export abstract class BaseAIProvider implements AIProvider {
  /** 供应商配置 */
  protected readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /** 供应商名称（子类必须指定） */
  abstract readonly name: string;

  /** 默认模型名 */
  get defaultModel(): string {
    return this.config.model;
  }

  /**
   * 解析本次调用使用的模型。
   * 优先使用 options.model，其次 config.model。
   */
  protected resolveModel(options?: ChatOptions): string {
    return options?.model ?? this.config.model;
  }

  /**
   * 解析请求超时。
   * 默认 60 秒。
   */
  protected resolveTimeout(options?: ChatOptions): number {
    return options?.timeoutMs ?? 60_000;
  }

  /** 同步聊天（子类实现） */
  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse>;

  /** 流式聊天（子类实现） */
  abstract streamChat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<ChatChunk>;
}
