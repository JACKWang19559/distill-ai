/**
 * OpenAI 供应商适配器。
 *
 * 调用 OpenAI Chat Completions API：
 * - 同步：POST /v1/chat/completions（stream=false）
 * - 流式：POST /v1/chat/completions（stream=true，SSE）
 *
 * 兼容供应商（Qwen / DeepSeek / Zhipu）通过继承本类、
 * 覆盖 `name` 与默认 baseUrl 即可。
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

/** OpenAI 默认 API 地址 */
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/** OpenAI 请求体（部分字段） */
interface OpenAIRequestBody {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "text" | "json_object" };
  stream: boolean;
}

/** OpenAI 非流式响应 */
interface OpenAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: { message: string; type: string; code?: string };
}

/** OpenAI 流式块 */
interface OpenAIStreamChunk {
  choices: Array<{
    delta: { content?: string; role?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI 供应商适配器。
 */
export class OpenAIProvider extends BaseAIProvider {
  readonly name: string = "openai";

  constructor(config: ProviderConfig) {
    super(config);
  }

  /** 获取 baseUrl（默认 OpenAI 官方） */
  protected get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }

  /** 构建请求头 */
  protected buildHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /** 构建请求体 */
  protected buildRequestBody(
    messages: ChatMessage[],
    options: ChatOptions | undefined,
    stream: boolean
  ): OpenAIRequestBody {
    const body: OpenAIRequestBody = {
      model: this.resolveModel(options),
      messages,
      stream,
    };

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    return body;
  }

  /** 同步聊天 */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
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

      const data = (await res.json()) as OpenAIResponse;

      if (!res.ok || data.error) {
        const msg = data.error?.message ?? `HTTP ${res.status}`;
        throw new AIProviderError(this.name, msg, { statusCode: res.status });
      }

      const choice = data.choices?.[0];
      if (!choice) {
        throw new AIProviderError(this.name, "响应缺少 choices 字段");
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
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
    const url = `${this.baseUrl}/chat/completions`;
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // 保留最后一个不完整行
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            yield { delta: "", done: true };
            return;
          }

          try {
            const chunk = JSON.parse(payload) as OpenAIStreamChunk;
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            const finishReason = chunk.choices?.[0]?.finish_reason;

            if (delta) {
              yield { delta, done: false };
            }

            if (finishReason === "stop" || chunk.usage) {
              yield {
                delta: "",
                done: true,
                usage: chunk.usage
                  ? {
                      promptTokens: chunk.usage.prompt_tokens,
                      completionTokens: chunk.usage.completion_tokens,
                      totalTokens: chunk.usage.total_tokens,
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

      // 流自然结束（未收到 [DONE]）
      yield { delta: "", done: true };
    } finally {
      clearTimeout(timer);
    }
  }
}
