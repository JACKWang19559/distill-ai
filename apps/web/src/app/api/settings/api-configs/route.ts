/**
 * API 配置管理端点。
 *
 * GET    /api/settings/api-configs          获取用户所有 API 配置（API Key 脱敏）
 * POST   /api/settings/api-configs          创建新 API 配置（API Key 加密存储）
 * PATCH  /api/settings/api-configs/[id]     更新 API 配置
 * DELETE /api/settings/api-configs/[id]     删除 API 配置
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { encrypt, maskApiKey, decrypt } from "@/lib/crypto";

/** 供应商默认模型映射 */
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20241022",
  qwen: "qwen-plus",
  deepseek: "deepseek-chat",
  zhipu: "glm-4",
  minimax: "MiniMax-Text-01",
  // ASR 供应商
  siliconflow: "FunAudioLLM/SenseVoiceSmall",
  groq: "whisper-large-v3",
  openai_asr: "whisper-1",
};

/** ASR 供应商默认 API URL */
const ASR_DEFAULT_API_URLS: Record<string, string> = {
  siliconflow: "https://api.siliconflow.cn/v1/audio/transcriptions",
  groq: "https://api.groq.com/openai/v1/audio/transcriptions",
  openai: "https://api.openai.com/v1/audio/transcriptions",
};

/** 创建 API 配置 schema */
const createConfigSchema = z.object({
  configType: z.enum(["llm", "asr"]).default("llm"),
  provider: z.string().min(1),
  name: z.string().min(1).max(50),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

/**
 * 获取用户所有 API 配置。
 *
 * 返回的 apiKey 字段为掩码（如 sk-a1b2****c3d4），
 * 不暴露完整密钥。
 *
 * 支持通过 query 参数 configType 过滤（llm/asr）。
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    // 支持 ?configType=llm|asr 过滤
    const { searchParams } = new URL(request.url);
    const configType = searchParams.get("configType");

    const whereClause: { userId: string; configType?: string } = {
      userId: session.user.id,
    };
    if (configType === "llm" || configType === "asr") {
      whereClause.configType = configType;
    }

    const configs = await prisma.apiConfig.findMany({
      where: whereClause,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    // 脱敏：将加密的 apiKey 解密后掩码
    const maskedConfigs = configs.map((c) => {
      let maskedKey = "****";
      try {
        const decryptedKey = decrypt(c.apiKey);
        maskedKey = maskApiKey(decryptedKey);
      } catch {
        maskedKey = "****（解密失败）";
      }
      return {
        id: c.id,
        configType: c.configType,
        provider: c.provider,
        name: c.name,
        apiKey: maskedKey,
        model: c.model,
        baseUrl: c.baseUrl,
        isActive: c.isActive,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({ success: true, data: maskedConfigs });
  } catch (error) {
    console.error("获取 API 配置失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/**
 * 创建新 API 配置。
 *
 * - API Key 使用 AES-256-GCM 加密后存储
 * - 如果 isActive=true，先将用户同类型（llm/asr）的其他配置设为非激活
 * - model 未提供时使用供应商默认模型
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = createConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message ?? "输入校验失败",
          },
        },
        { status: 400 }
      );
    }

    const { configType, provider, name, apiKey, model, baseUrl, isActive } = parseResult.data;

    // 如果设为激活，先取消同类型的其他激活配置
    if (isActive) {
      await prisma.apiConfig.updateMany({
        where: {
          userId: session.user.id,
          configType,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // 加密 API Key
    const encryptedKey = encrypt(apiKey);

    // 确定默认模型
    const defaultModelKey = configType === "asr" ? provider : provider;
    const finalModel = model ?? PROVIDER_DEFAULT_MODELS[defaultModelKey] ?? "gpt-4o";

    // ASR 配置：如果未提供 baseUrl，使用供应商默认 API URL
    let finalBaseUrl = baseUrl ?? null;
    if (configType === "asr" && !finalBaseUrl && ASR_DEFAULT_API_URLS[provider]) {
      finalBaseUrl = ASR_DEFAULT_API_URLS[provider];
    }

    // 创建配置
    const config = await prisma.apiConfig.create({
      data: {
        userId: session.user.id,
        configType,
        provider,
        name,
        apiKey: encryptedKey,
        model: finalModel,
        baseUrl: finalBaseUrl,
        isActive: isActive ?? false,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: config.id,
          configType: config.configType,
          provider: config.provider,
          name: config.name,
          model: config.model,
          baseUrl: config.baseUrl,
          isActive: config.isActive,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("创建 API 配置失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
