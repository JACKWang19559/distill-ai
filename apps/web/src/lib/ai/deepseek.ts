/**
 * DeepSeek 供应商适配器。
 *
 * DeepSeek API 完全兼容 OpenAI 格式，仅 baseUrl 不同。
 *
 * 文档：https://api-docs.deepseek.com/
 */

import { OpenAIProvider } from "./openai";
import type { ProviderConfig } from "./types";

/** DeepSeek 默认 API 地址 */
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

/**
 * DeepSeek 供应商适配器。
 *
 * 继承 OpenAIProvider，仅覆盖 name 与默认 baseUrl。
 */
export class DeepSeekProvider extends OpenAIProvider {
  readonly name = "deepseek";

  constructor(config: ProviderConfig) {
    super(config);
  }

  protected get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }
}
