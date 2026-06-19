export const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL ?? "http://localhost:8001";
export const UPLOAD_DIR = "uploads";
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".txt", ".md"];
export const PDF_CHUNK_MAX_CHARS = 16_000;
