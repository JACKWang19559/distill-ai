/**
 * 媒体处理服务地址。
 *
 * 本地开发：http://localhost:8001
 * 生产环境：通过 MEDIA_SERVICE_URL 环境变量配置（Render.com 部署的地址）
 */
export const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL ?? "http://localhost:8001";

/**
 * 文件上传目录。
 *
 * Vercel 生产环境只有 /tmp 可写，本地开发使用项目目录下的 uploads。
 */
export const UPLOAD_DIR = process.env.NODE_ENV === "production"
  ? "/tmp/distill-uploads"
  : "uploads";

/** 最大上传文件大小（20MB） */
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

/** 允许的上传文件扩展名 */
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".txt", ".md"];

/** PDF 分块蒸馏的最大字符数 */
export const PDF_CHUNK_MAX_CHARS = 16_000;
