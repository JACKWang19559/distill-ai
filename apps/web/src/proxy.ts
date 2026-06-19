/**
 * Next.js 代理（原 middleware）：路由保护。
 *
 * - 未登录用户访问 /dashboard、/library、/search、/graph、/settings 时重定向到 /login
 * - 已登录用户访问 /login、/register 时重定向到 /dashboard
 *
 * 使用 getToken 检查 JWT（不依赖 Prisma，兼容 edge 运行时）。
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * 受保护的路由前缀列表。
 * 未登录用户访问这些路径将被重定向到登录页。
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/library",
  "/search",
  "/graph",
  "/settings",
];

/**
 * 认证页面路径。
 * 已登录用户访问这些路径将被重定向到 dashboard。
 */
const AUTH_ROUTES = ["/login", "/register"];

/**
 * Next.js 代理入口函数。
 *
 * @param request - NextRequest 对象
 * @returns NextResponse（放行或重定向）
 */
export async function proxy(request: NextRequest) {
  const { nextUrl } = request;

  // 使用 getToken 检查 JWT（不需要 Prisma，兼容 edge 运行时）
  // NextAuth v5 使用 authjs.session-token 作为 cookie 名（生产环境带 __Secure- 前缀）
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "authjs.session-token",
  });
  const isLoggedIn = !!token;

  // 调试日志：检查 cookie 是否存在
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("authjs.session-token")?.value;

  console.log("[Proxy]", {
    path: nextUrl.pathname,
    isLoggedIn,
    hasToken: !!token,
    hasSecret: !!process.env.NEXTAUTH_SECRET,
    hasSessionCookie: !!sessionCookie,
  });

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    nextUrl.pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.includes(nextUrl.pathname);

  // 未登录访问受保护路由 → 重定向到登录页
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 已登录访问认证页面 → 重定向到 dashboard
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

/**
 * 代理匹配配置。
 * 排除静态资源、API（除受保护的 API）、_next 等。
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
