/**
 * 文件上传 API 端点。
 *
 * POST /api/upload
 * - multipart/form-data，字段名 file
 * - 限制：20MB，类型 .pdf/.txt/.md
 * - 保存到 uploads/{userId}/{uuid}.{ext}
 * - 返回 filePath 供 /api/distill 使用
 */

import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/config";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  UPLOAD_DIR,
  MAX_UPLOAD_SIZE,
  ALLOWED_UPLOAD_EXTENSIONS,
} from "@/lib/config";

/**
 * 处理文件上传。
 *
 * 1. 认证校验
 * 2. 解析 multipart/form-data
 * 3. 校验文件大小和扩展名
 * 4. 保存到 uploads/{userId}/{uuid}.{ext}
 * 5. 返回文件路径
 */
export async function POST(request: Request) {
  // 速率限制：每 IP 每分钟最多 5 次上传
  const limit = rateLimit(request, { windowMs: 60000, max: 5, keyPrefix: "upload" });
  if (!limit.success) {
    return rateLimitResponse(limit.resetAt);
  }

  try {
    // 1. 认证校验
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    // 2. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "未提供文件" },
        },
        { status: 400 }
      );
    }

    // 3. 校验文件大小
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: `文件大小超过限制（最大 ${MAX_UPLOAD_SIZE / 1024 / 1024}MB）`,
          },
        },
        { status: 400 }
      );
    }

    // 4. 校验文件扩展名
    const fileName = file.name || "unknown";
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: `不支持的文件类型: ${ext}，仅支持 ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // 5. 保存文件
    // UPLOAD_DIR 在生产环境是绝对路径 /tmp/distill-uploads，在开发环境是相对路径 uploads
    // 使用 path.isAbsolute 判断，避免在绝对路径前误加 process.cwd()
    const userId = session.user.id;
    const baseDir = path.isAbsolute(UPLOAD_DIR)
      ? UPLOAD_DIR
      : path.join(process.cwd(), UPLOAD_DIR);
    const uploadDir = path.join(baseDir, userId);
    await fs.mkdir(uploadDir, { recursive: true });

    const savedName = `${randomUUID()}${ext}`;
    const savedPath = path.join(uploadDir, savedName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(savedPath, Buffer.from(arrayBuffer));

    console.log(`[Upload] 用户 ${userId} 上传文件: ${fileName} → ${savedPath}`);

    // 6. 返回文件路径
    return NextResponse.json(
      {
        success: true,
        data: {
          filePath: savedPath,
          fileName: fileName,
          size: file.size,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("文件上传失败:", error);
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
