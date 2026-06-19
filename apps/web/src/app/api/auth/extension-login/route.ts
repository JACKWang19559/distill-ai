/**
 * 浏览器插件登录 API 端点。
 *
 * POST /api/auth/extension-login
 *   接收邮箱密码，校验后返回长期 API token（存入 ApiToken 表）。
 *
 * DELETE /api/auth/extension-login
 *   注销插件 token（吊销）。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

/** 登录请求体 schema */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * 插件登录：邮箱密码换取 API token。
 *
 * 流程：
 * 1. 校验邮箱密码
 * 2. 生成随机 token（32 字节 hex）
 * 3. 存入 ApiToken 表（永不过期，可手动吊销）
 * 4. 返回 token + 用户信息
 */
export async function POST(request: Request) {
  // 速率限制：每 IP 每分钟最多 5 次登录尝试
  const limit = rateLimit(request, { windowMs: 60000, max: 5, keyPrefix: "ext-login" });
  if (!limit.success) {
    return rateLimitResponse(limit.resetAt);
  }

  try {
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "邮箱或密码格式不正确",
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, image: true, password: true },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
        },
        { status: 401 }
      );
    }

    // 校验密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
        },
        { status: 401 }
      );
    }

    // 生成随机 token（32 字节 = 64 位 hex 字符串）
    const token = randomBytes(32).toString("hex");

    // 存入 ApiToken 表
    await prisma.apiToken.create({
      data: {
        userId: user.id,
        token,
        name: "Chrome 扩展",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
      },
    });
  } catch (error) {
    console.error("插件登录失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      },
      { status: 500 }
    );
  }
}

/**
 * 注销插件 token。
 *
 * 请求体：{ token: string }
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "缺少 token" },
        },
        { status: 400 }
      );
    }

    await prisma.apiToken.deleteMany({
      where: { token },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("注销 token 失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      },
      { status: 500 }
    );
  }
}
