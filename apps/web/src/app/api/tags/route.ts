/**
 * 标签 API。
 *
 * GET  /api/tags    获取用户所有标签
 * POST /api/tags    创建新标签
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { listTags, createTag } from "@/services/tag.service";

/** 创建标签 schema */
const createTagSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/** 获取用户所有标签 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const tags = await listTags(session.user.id);
    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    console.error("获取标签列表失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/** 创建新标签 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = createTagSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message ?? "输入校验失败",
          },
        },
        { status: 400 }
      );
    }

    const tag = await createTag(session.user.id, parseResult.data);
    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    const status = message.includes("已存在") ? 409 : 500;
    return NextResponse.json(
      { success: false, error: { code: status === 409 ? "CONFLICT" : "INTERNAL_ERROR", message } },
      { status }
    );
  }
}
