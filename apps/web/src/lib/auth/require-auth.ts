/**
 * 统一认证辅助函数。
 *
 * 支持两种认证方式：
 * 1. NextAuth cookie session（Web 端使用）
 * 2. Bearer token（浏览器插件使用，存储于 ApiToken 表）
 *
 * 优先尝试 cookie session，失败后回退到 bearer token。
 */

import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

/** 认证结果 */
export interface AuthResult {
  userId: string;
  /** 认证方式：cookie（Web 端）或 token（插件） */
  method: "cookie" | "token";
}

/**
 * 从请求中提取并校验认证信息。
 *
 * @param request - 可选的 Request 对象，提供时会尝试 bearer token 认证
 * @returns 认证结果（含 userId），未认证返回 null
 */
export async function requireAuth(
  request?: Request
): Promise<AuthResult | null> {
  // 1. 优先尝试 NextAuth cookie session
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, method: "cookie" };
  }

  // 2. 回退到 bearer token（浏览器插件）
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const apiToken = await prisma.apiToken.findUnique({
          where: { token },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
          },
        });

        if (!apiToken) {
          return null;
        }

        // 校验过期时间
        if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
          return null;
        }

        // 异步更新最后使用时间（不阻塞请求）
        prisma.apiToken
          .update({
            where: { id: apiToken.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {
            // 忽略更新失败
          });

        return { userId: apiToken.userId, method: "token" };
      }
    }
  }

  return null;
}

/**
 * 创建未认证的统一响应。
 */
export function unauthorizedResponse() {
  return Response.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
    { status: 401 }
  );
}
