/**
 * 智谱 GLM 供应商适配器。
 *
 * 智谱 AI 开放平台提供 OpenAI 兼容接口，
 * 接口格式与 OpenAI 一致，仅 baseUrl 不同。
 *
 * 文档：https://open.bigmodel.cn/dev/api
 */

import { OpenAIProvider } from "./openai";
import type { ProviderConfig } from "./types";

/** 智谱 GLM 默认 API 地址 */
const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

/**
 * 智谱 GLM 供应商适配器。
 *
 * 继承 OpenAIProvider，仅覆盖 name 与默认 baseUrl。
 */
export class ZhipuProvider extends OpenAIProvider {
  readonly name = "zhipu";

  constructor(config: ProviderConfig) {
    super(config);
  }

  protected get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }
}
