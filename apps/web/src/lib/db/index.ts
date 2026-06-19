import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Prisma 客户端单例。
 *
 * Prisma 7 使用 driver adapter 模式连接数据库。
 * 在开发环境下避免热重载时创建多个连接，
 * 通过 globalThis 缓存 PrismaClient 实例。
 *
 * 环境变量优先级：
 * 1. DATABASE_URL（本地开发、标准 PostgreSQL 连接）
 * 2. POSTGRES_PRISMA_URL（Vercel Postgres / Supabase 自动提供）
 */

// 获取数据库连接字符串
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error(
    "数据库连接字符串未配置。请设置 DATABASE_URL 或 POSTGRES_PRISMA_URL 环境变量。"
  );
}

// 创建 PostgreSQL 连接池
const pool = new Pool({
  connectionString: databaseUrl,
});

// 创建 Prisma PostgreSQL adapter
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
