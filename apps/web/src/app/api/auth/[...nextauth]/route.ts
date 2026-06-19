/**
 * NextAuth.js API 路由处理器。
 *
 * 将 NextAuth 的 handlers 导出为 GET / POST，
 * 挂载到 /api/auth/[...nextauth] 路径。
 */
import { handlers } from "@/lib/auth/config";

export const { GET, POST } = handlers;
