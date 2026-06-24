/**
 * Minimax 供应商适配器。
 *
 * Minimax ChatCompletion v2 API 兼容 OpenAI 格式，仅 baseUrl 不同。
 *
 * 文档：https://platform.minimaxi.com/
 */

import { OpenAIProvider } from "./openai";
import type { ProviderConfig } from "./types";

/** Minimax 默认 API 地址 */
const DEFAULT_BASE_URL = "https://api.minimaxi.com/v1";

/**
 * Minimax 供应商适配器。
 *
 * 继承 OpenAIProvider，仅覆盖 name 与默认 baseUrl。
 */
export class MinimaxProvider extends OpenAIProvider {
  readonly name = "minimax";

  constructor(config: ProviderConfig) {
    super(config);
  }

  protected get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }
}
