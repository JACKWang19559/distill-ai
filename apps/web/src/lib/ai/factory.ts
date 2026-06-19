/**
 * AI 供应商工厂与路由。
 *
 * 职责：
 * 1. 注册所有供应商适配器
 * 2. 根据供应商名称 + 配置创建适配器实例
 * 3. `getActiveProvider(userId)`：从数据库读取用户激活的 API 配置，
 *    解密 API Key，返回可用的 AIProvider 实例
 */

import type { AIProviderType } from "@distill/shared";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { ProviderConfig } from "./types";
import { AIProviderError } from "./types";
import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { DeepSeekProvider } from "./deepseek";
import { OpenAIProvider } from "./openai";
import { QwenProvider } from "./qwen";
import { ZhipuProvider } from "./zhipu";

/** 供应商构造函数类型 */
type ProviderConstructor = new (config: ProviderConfig) => AIProvider;

/**
 * AI 供应商工厂。
 *
 * 使用方式：
 * ```ts
 * const provider = AIProviderFactory.create("openai", {
 *   apiKey: "sk-xxx",
 *   model: "gpt-4o",
 * });
 * ```
 */
export class AIProviderFactory {
  /** 已注册的供应商构造函数 */
  private static readonly providers = new Map<string, ProviderConstructor>();

  /**
   * 注册供应商。
   *
   * @param name 供应商名称（与 AIProviderType 对应）
   * @param ctor 供应商构造函数
   */
  static register(name: string, ctor: ProviderConstructor): void {
    this.providers.set(name, ctor);
  }

  /**
   * 创建供应商实例。
   *
   * @param name 供应商名称
   * @param config 供应商配置（apiKey, model, baseUrl?）
   * @returns 供应商实例
   * @throws {AIProviderError} 未注册的供应商
   */
  static create(name: string, config: ProviderConfig): AIProvider {
    const ctor = this.providers.get(name);
    if (!ctor) {
      throw new AIProviderError(
        name,
        `未注册的供应商: ${name}，已注册: ${[...this.providers.keys()].join(", ")}`
      );
    }
    return new ctor(config);
  }

  /** 获取所有已注册的供应商名称 */
  static getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }
}

// ============================================================================
// 注册所有供应商
// ============================================================================

AIProviderFactory.register("openai", OpenAIProvider);
AIProviderFactory.register("anthropic", AnthropicProvider);
AIProviderFactory.register("qwen", QwenProvider);
AIProviderFactory.register("deepseek", DeepSeekProvider);
AIProviderFactory.register("zhipu", ZhipuProvider);

/**
 * 获取用户当前激活的 AI 供应商。
 *
 * 流程：
 * 1. 从数据库读取用户 `isActive=true` 的 ApiConfig
 * 2. 解密 API Key
 * 3. 通过工厂创建供应商实例
 *
 * @param userId 用户 ID
 * @returns 激活的 AIProvider 实例
 * @throws {AIProviderError} 未配置 API 或解密失败
 */
export async function getActiveProvider(userId: string): Promise<AIProvider> {
  // 查询用户激活的 API 配置
  const apiConfig = await prisma.apiConfig.findFirst({
    where: {
      userId,
      isActive: true,
    },
  });

  if (!apiConfig) {
    throw new AIProviderError(
      "factory",
      "未找到激活的 API 配置，请先在设置页配置 AI 供应商"
    );
  }

  // 解密 API Key
  let apiKey: string;
  try {
    apiKey = decrypt(apiConfig.apiKey);
  } catch (err) {
    throw new AIProviderError(
      apiConfig.provider,
      `API Key 解密失败: ${(err as Error).message}`,
      { cause: err }
    );
  }

  // 创建供应商实例
  const config: ProviderConfig = {
    apiKey,
    model: apiConfig.model,
    baseUrl: apiConfig.baseUrl ?? undefined,
  };

  return AIProviderFactory.create(apiConfig.provider, config);
}

/**
 * 获取用户所有 API 配置（脱敏）。
 *
 * @param userId 用户 ID
 * @returns API 配置列表（apiKey 字段为掩码）
 */
export async function listUserApiConfigs(userId: string) {
  const configs = await prisma.apiConfig.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      name: true,
      model: true,
      baseUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return configs;
}

/**
 * 类型守卫：验证字符串是否为合法的 AIProviderType。
 */
export function isValidProviderType(value: string): value is AIProviderType {
  return AIProviderFactory.getRegisteredProviders().includes(value);
}
