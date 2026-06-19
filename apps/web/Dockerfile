# ============================================================================
# Distill AI 知识蒸馏站 - Web 应用 Dockerfile
#
# 多阶段构建：
# 1. deps: 安装依赖（利用缓存层）
# 2. builder: 构建 Next.js standalone 产物
# 3. runner: 最小化生产镜像
# ============================================================================

# ---------- 阶段 1: deps ----------
FROM node:20-alpine AS deps

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制 workspace 配置（利用缓存）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖（frozen-lockfile 确保一致性）
RUN pnpm install --frozen-lockfile

# ---------- 阶段 2: builder ----------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制依赖（从 deps 阶段）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# 复制源代码
COPY . .

# 环境变量（构建时需要）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建 Next.js（standalone 模式）
WORKDIR /app/apps/web
RUN pnpm build

# ---------- 阶段 3: runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 wget（用于 healthcheck）
RUN apk add --no-cache wget

# 安全：使用非 root 用户运行
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# 复制 standalone 产物
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# 复制 Prisma schema（用于 db push）
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

# 复制启动脚本
COPY --from=builder /app/apps/web/docker-entrypoint.sh ./apps/web/docker-entrypoint.sh
RUN chmod +x ./apps/web/docker-entrypoint.sh

# 创建上传目录
RUN mkdir -p /app/apps/web/uploads && chown nextjs:nodejs /app/apps/web/uploads

# 切换用户
USER nextjs

# 端口
EXPOSE 3000

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动命令
CMD ["sh", "./apps/web/docker-entrypoint.sh"]
