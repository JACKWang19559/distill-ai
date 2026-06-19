/**
 * 用户注册 API 端点。
 *
 * POST /api/auth/register
 * Body: { name, email, password }
 *
 * - 校验输入（邮箱格式、密码长度 >= 6）
 * - 检查邮箱是否已注册
 * - 使用 bcrypt 哈希密码（salt rounds = 10）
 * - 创建用户后返回基本信息（不含密码）
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

/**
 * 校验邮箱格式。
 *
 * @param email - 待校验的邮箱字符串
 * @returns 是否为合法邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 处理注册请求。
 *
 * @param request - Next.js Request 对象
 * @returns JSON 响应（成功返回用户信息，失败返回错误信息）
 */
export async function POST(request: Request) {
  // 速率限制：每 IP 每分钟最多 3 次注册请求
  const limit = rateLimit(request, { windowMs: 60000, max: 3, keyPrefix: "register" });
  if (!limit.success) {
    return rateLimitResponse(limit.resetAt);
  }

  try {
    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    // 输入校验
    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码为必填项" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "邮箱格式不正确" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少 6 位" },
        { status: 400 }
      );
    }

    // 检查邮箱是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      );
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "注册成功", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("注册失败:", error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
