/**
 * NextAuth.js v5 配置文件。
 *
 * 支持 GitHub OAuth 登录 + 邮箱密码登录（Credentials Provider）。
 * 使用 Prisma Adapter 持久化用户/会话到 PostgreSQL。
 */
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * NextAuth 配置实例。
 *
 * - adapter: Prisma Adapter，将用户/账户/会话存入数据库
 * - session: 使用 JWT 策略（无状态，适合 Serverless）
 * - providers:
 *   - GitHub OAuth（需配置 GITHUB_ID / GITHUB_SECRET）
 *   - Credentials（邮箱 + 密码，密码使用 bcrypt 校验）
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      name: "邮箱密码",
      credentials: {
        email: {
          label: "邮箱",
          type: "email",
          placeholder: "you@example.com",
        },
        password: {
          label: "密码",
          type: "password",
        },
      },
      /**
       * 校验邮箱密码登录。
       *
       * @param credentials - 前端提交的凭据
       * @returns 用户对象（含 id/email/name）或 null（登录失败）
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email);
        const password = String(credentials.password);

        // 查找用户（必须有密码才能用 Credentials 登录）
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        // 校验密码
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * JWT 回调：将用户 id 注入 token。
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    /**
     * Session 回调：将 token.id 注入 session.user.id。
     */
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
