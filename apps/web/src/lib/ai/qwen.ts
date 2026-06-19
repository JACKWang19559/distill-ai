/**
 * 通义千问（Qwen）供应商适配器。
 *
 * 阿里云 DashScope 提供 OpenAI 兼容模式，
 * 接口格式与 OpenAI 完全一致，仅 baseUrl 不同。
 *
 * 文档：https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope
 */

import { OpenAIProvider } from "./openai";
import type { ProviderConfig } from "./types";

/** 通义千问 OpenAI 兼容模式默认地址 */
const DEFAULT_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

/**
 * 通义千问供应商适配器。
 *
 * 继承 OpenAIProvider，仅覆盖 name 与默认 baseUrl。
 */
export class QwenProvider extends OpenAIProvider {
  readonly name = "qwen";

  constructor(config: ProviderConfig) {
    super(config);
  }

  protected get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }
}
