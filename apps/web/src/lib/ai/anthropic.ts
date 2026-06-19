/**
 * Anthropic（Claude）供应商适配器。
 *
 * 调用 Anthropic Messages API：
 * - 同步：POST /v1/messages
 * - 流式：POST /v1/messages（stream=true，SSE）
 *
 * 与 OpenAI 的差异：
 * - system 消息放在顶层 `system` 字段，不混入 messages
 * - 请求头使用 `x-api-key` + `anthropic-version`
 * - 响应 content 是数组：[{ type: "text", text }]
 * - usage 字段名：input_tokens / output_tokens
 */

import { BaseAIProvider } from "./provider";
import { AIProviderError } from "./types";
import type {
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ProviderConfig,
} from "./types";

/** Anthropic 默认 API 地址 */
const DEFAULT_BASE_URL = "https://api.anthropic.com";

/** Anthropic API 版本 */
const ANTHROPIC_VERSION = "2023-06-01";

/** Anthropic 请求体 */
interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  system?: string;
  temperature?: number;
  stream: boolean;
}

/** Anthropic 非流式响应 */
interface AnthropicResponse {
  id: string;
  model: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: { type: string; message: string };
}

/** Anthropic 流式事件 */
interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  message?: {
    usage?: { input_tokens: number; output_tokens: number };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic 供应商适配器。
 */
export class AnthropicProvider extends BaseAIProvider {
  readonly name: string = "anthropic";

  constructor(config: ProviderConfig) {
    super(config);
  }

  /** 获取 baseUrl */
  protected get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }

  /** 构建请求头 */
  protected buildHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    };
  }

  /**
   * 拆分消息：system 消息提取到顶层，其余保留为 user/assistant。
   * Anthropic 不允许 messages 中出现 system 角色。
   */
  protected splitMessages(messages: ChatMessage[]): {
    system?: string;
    chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
  } {
    const systemParts: string[] = [];
    const chatMessages: Array<{ role: "user" | "assistant"; content: string }> =
      [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    return {
      system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
      chatMessages,
    };
  }

  /** 构建请求体 */
  protected buildRequestBody(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: boolean
  ): AnthropicRequestBody {
    const { system, chatMessages } = this.splitMessages(messages);
    const body: AnthropicRequestBody = {
      model: this.resolveModel(options),
      max_tokens: options?.maxTokens ?? 4096,
      messages: chatMessages,
      stream,
    };

    if (system) body.system = system;
    if (options?.temperature !== undefined) body.temperature = options.temperature;

    return body;
  }

  /** 同步聊天 */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const url = `${this.baseUrl}/v1/messages`;
    const body = this.buildRequestBody(messages, options, false);
    const timeout = this.resolveTimeout(options);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = (await res.json()) as AnthropicResponse;

      if (!res.ok || data.error) {
        const msg = data.error?.message ?? `HTTP ${res.status}`;
        throw new AIProviderError(this.name, msg, { statusCode: res.status });
      }

      const textParts = data.content
        .filter((c) => c.type === "text")
        .map((c) => c.text);
      const content = textParts.join("");

      return {
        content,
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens:
            (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        model: data.model,
        raw: data,
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError(this.name, `请求超时（${timeout}ms）`, {
          cause: err,
        });
      }
      throw new AIProviderError(this.name, `请求失败: ${(err as Error).message}`, {
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** 流式聊天 */
  async *streamChat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncIterable<ChatChunk> {
    const url = `${this.baseUrl}/v1/messages`;
    const body = this.buildRequestBody(messages, options, true);
    const timeout = this.resolveTimeout(options);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...this.buildHeaders(), Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AIProviderError(
          this.name,
          `HTTP ${res.status}: ${text || res.statusText}`,
          { statusCode: res.status }
        );
      }

      if (!res.body) {
        throw new AIProviderError(this.name, "响应缺少 body 流");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalUsage:
        | { input_tokens: number; output_tokens: number }
        | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const evt = JSON.parse(payload) as AnthropicStreamEvent;

            // 文本增量
            if (
              evt.type === "content_block_delta" &&
              evt.delta?.type === "text_delta" &&
              evt.delta.text
            ) {
              yield { delta: evt.delta.text, done: false };
            }

            // 消息结束，携带 usage
            if (evt.type === "message_delta" && evt.usage) {
              finalUsage = evt.usage;
            }
            if (evt.type === "message_stop") {
              yield {
                delta: "",
                done: true,
                usage: finalUsage
                  ? {
                      promptTokens: finalUsage.input_tokens,
                      completionTokens: finalUsage.output_tokens,
                      totalTokens:
                        finalUsage.input_tokens + finalUsage.output_tokens,
                    }
                  : undefined,
              };
              return;
            }
          } catch {
            // 跳过无法解析的行
          }
        }
      }

      yield { delta: "", done: true };
    } finally {
      clearTimeout(timer);
    }
  }
}
