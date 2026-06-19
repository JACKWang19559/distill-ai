/**
 * NextAuth.js 类型扩展。
 *
 * 在 Session.user 和 JWT token 中添加 id 字段，
 * 以便在应用中通过 session.user.id 获取当前用户 ID。
 */
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * 扩展 Session 中的 user 字段，添加 id。
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * 扩展 JWT token，添加 id 字段。
   */
  interface JWT {
    id?: string;
  }
}
