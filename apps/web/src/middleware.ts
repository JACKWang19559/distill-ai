/**
 * Next.js 中间件：路由保护。
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
 * Next.js 中间件入口函数。
 *
 * @param request - NextRequest 对象
 * @returns NextResponse（放行或重定向）
 */
export async function middleware(request: NextRequest) {
  const { nextUrl } = request;

  // 使用 getToken 检查 JWT（不需要 Prisma，兼容 edge 运行时）。
  // NextAuth v5 在 https 环境下使用 __Secure-authjs.session-token cookie。
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "authjs.session-token",
    secureCookie: true,
  });
  const isLoggedIn = !!token;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    nextUrl.pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.includes(nextUrl.pathname);

  // 未登录访问受保护路由 → 重定向到登录页
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${nextUrl.pathname}${nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  // 已登录访问认证页面 → 重定向到 dashboard
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

/**
 * 中间件匹配配置。
 * 排除静态资源、API、_next 内部路由等。
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.).*)",
  ],
};
