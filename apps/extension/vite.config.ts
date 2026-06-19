/**
 * Vite 配置 - Chrome 扩展（CRXJS 插件）。
 *
 * 使用 @crxjs/vite-plugin 实现 HMR 和 Manifest V3 自动打包。
 * 注意：项目路径含 # 字符，需要配置 resolve.alias 确保路径解析正确。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/chunk-[hash].js",
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
