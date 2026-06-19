import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 生产构建模式：
   * - Vercel 部署：默认模式（不设置 output）
   * - Docker 部署：standalone 模式（通过环境变量控制）
   */
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
  /**
   * 服务端外部包配置
   * 允许在服务端使用这些包而不打包
   */
  serverExternalPackages: ["@prisma/client", "pg", "bcryptjs"],
  /**
   * 实验性功能
   */
  experimental: {
    /**
     * 优化服务端依赖
     */
    optimizePackageImports: ["lucide-react", "@xyflow/react"],
  },
};

export default nextConfig;
