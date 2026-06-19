#!/bin/sh
# ============================================================================
# Web 应用启动入口脚本
#
# 1. 等待数据库就绪
# 2. 运行 prisma db push（同步 schema）
# 3. 启动 Next.js 服务
# ============================================================================

set -e

echo "=== Distill Web 启动 ==="

# 等待数据库就绪
echo "等待数据库就绪..."
until node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => client.end())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  echo "数据库未就绪，2 秒后重试..."
  sleep 2
done
echo "数据库已就绪"

# 同步 Prisma schema
echo "同步数据库 schema..."
cd /app/apps/web
npx prisma db push --accept-data-loss
echo "Schema 同步完成"

# 启动 Next.js
echo "启动 Next.js 服务..."
exec node server.js
