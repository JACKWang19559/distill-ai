import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 配置文件。
 *
 * Prisma 7 将数据库连接配置从 schema.prisma 移到 prisma.config.ts，
 * 并使用 adapter 方式连接数据库。
 *
 * 环境变量优先级：
 * 1. DATABASE_URL（本地开发、标准 PostgreSQL 连接）
 * 2. POSTGRES_PRISMA_URL（Vercel Postgres / Supabase 自动提供）
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL") ?? env("POSTGRES_PRISMA_URL"),
  },
});
