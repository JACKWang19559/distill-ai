import { redirect } from "next/navigation";

/**
 * 根页面：重定向到 /dashboard。
 *
 * 未登录用户会被中间件重定向到 /login。
 */
export default function HomePage() {
  redirect("/dashboard");
}
