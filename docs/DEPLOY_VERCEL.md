# Distill AI 知识蒸馏站 - Vercel 部署指南

## 前置准备

### 1. 安装 Vercel CLI

```bash
npm install -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

## 部署步骤

### 步骤 1：创建 GitHub 仓库

1. 在 GitHub 创建新仓库
2. 将本地代码推送到 GitHub：

```bash
git init
git add .
git commit -m "Initial commit: Distill AI 知识蒸馏站"
git branch -M main
git remote add origin https://github.com/your-username/distill.git
git push -u origin main
```

### 步骤 2：在 Vercel 导入项目

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 选择 "Import Git Repository"
4. 选择你的 GitHub 仓库
5. 配置项目：
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm run vercel-build`
   - **Install Command**: `pnpm install`

### 步骤 3：创建 Vercel Postgres 数据库

1. 在 Vercel 项目页面，点击 "Storage" 标签
2. 点击 "Create Database"
3. 选择 "Postgres"
4. 数据库名称：`distill`
5. 区域选择：`Hong Kong (hkg1)`（与项目区域一致）
6. 点击 "Create"

### 步骤 4：配置环境变量

在 Vercel 项目的 "Settings" → "Environment Variables" 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | （自动从 Vercel Postgres 获取） | 数据库连接字符串 |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | 替换为你的 Vercel 域名 |
| `NEXTAUTH_SECRET` | （运行 `openssl rand -base64 32` 生成） | NextAuth 加密密钥 |
| `GITHUB_ID` | （GitHub OAuth App Client ID） | GitHub 登录凭证 |
| `GITHUB_SECRET` | （GitHub OAuth App Client Secret） | GitHub 登录密钥 |

### 步骤 5：配置 GitHub OAuth App

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写信息：
   - **Application name**: Distill
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`
4. 获取 Client ID 和 Client Secret
5. 将这些值添加到 Vercel 环境变量

### 步骤 6：部署

**方式一：通过 Vercel Dashboard 部署**
- 在 Vercel 项目页面点击 "Deploy"

**方式二：通过 CLI 部署**
```bash
vercel --prod
```

### 步骤 7：初始化数据库

部署成功后，需要初始化数据库表结构：

```bash
# 拉取 Vercel 环境变量到本地
vercel env pull .env.vercel

# 运行数据库推送（创建表结构）
cd apps/web
DATABASE_URL="your-vercel-postgres-url" pnpm db:push
```

或者通过 Vercel CLI 直接执行：
```bash
vercel env pull
npx prisma db push
```

## 验证部署

1. 访问 `https://your-app.vercel.app`
2. 点击"注册"创建账户
3. 登录后访问 Dashboard
4. 在"设置"中配置 AI API Key
5. 测试蒸馏功能

## 扩展配置

部署 Web 应用后，需要更新 Chrome 扩展的 API 地址：

1. 编辑 `apps/extension/src/lib/api.ts`
2. 将 API base URL 改为 Vercel 域名：
   ```typescript
   const API_BASE_URL = "https://your-app.vercel.app/api";
   ```
3. 重新构建扩展：`cd apps/extension && pnpm build`

## 常见问题

### Q: 构建失败 "prisma generate" 错误
A: 确保 `vercel-build` 脚本包含 `prisma generate`，已在 `package.json` 中配置。

### Q: 数据库连接失败
A: 检查 `DATABASE_URL` 环境变量是否正确配置，Vercel Postgres 会自动注入。

### Q: NextAuth 回调错误
A: 确保 `NEXTAUTH_URL` 与实际域名一致，GitHub OAuth App 的回调 URL 正确。

### Q: API 超时
A: Vercel 免费版 API 超时为 60 秒，蒸馏任务可能超时。建议：
- 升级到 Vercel Pro 版本（超时 300 秒）
- 或使用 SSE 流式传输（已实现）

## 成本估算

| 资源 | 免费额度 | 说明 |
|------|----------|------|
| Vercel Hobby | 100GB 带宽/月 | 个人项目足够 |
| Vercel Postgres | 256MB 存储 | 开发测试足够 |
| GitHub Actions | 2000 分钟/月 | CI/CD 足够 |

## 后续优化

1. **自定义域名**：在 Vercel 项目设置中添加自定义域名
2. **CDN 优化**：Vercel 自动提供全球 CDN
3. **监控**：启用 Vercel Analytics 监控应用性能
4. **日志**：使用 Vercel Logs 查看应用日志
