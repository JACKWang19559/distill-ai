/**
 * 知识详情 API。
 *
 * GET    /api/knowledge/[id]    获取知识详情
 * PATCH  /api/knowledge/[id]    更新知识（标题、笔记、标签）
 * DELETE /api/knowledge/[id]    软删除知识
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/require-auth";
import {
  getKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getRelatedKnowledge,
} from "@/services/knowledge.service";
import { updateTags } from "@/services/tag.service";

/** 更新知识 schema */
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  userNote: z.string().max(5000).nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

/** 获取知识详情 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const knowledge = await getKnowledge(id, authResult.userId);

    if (!knowledge) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "知识不存在" } },
        { status: 404 }
      );
    }

    // 获取关联知识
    const related = await getRelatedKnowledge(id, authResult.userId);

    return NextResponse.json({
      success: true,
      data: { ...knowledge, related },
    });
  } catch (error) {
    console.error("获取知识详情失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/** 更新知识 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const parseResult = updateSchema.safeParse(body);

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

    const { title, userNote, tagIds } = parseResult.data;

    // 更新标题和笔记（null → undefined 转换，service 层不接受 null）
    const updateData: { title?: string; userNote?: string } = {};
    if (title !== undefined) updateData.title = title;
    if (userNote !== undefined && userNote !== null) updateData.userNote = userNote;
    if (title !== undefined || userNote !== undefined) {
      const updated = await updateKnowledge(id, authResult.userId, updateData);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "知识不存在" } },
          { status: 404 }
        );
      }
    }

    // 更新标签
    if (tagIds !== undefined) {
      await updateTags(id, tagIds);
    }

    // 返回更新后的详情
    const knowledge = await getKnowledge(id, authResult.userId);
    return NextResponse.json({ success: true, data: knowledge });
  } catch (error) {
    console.error("更新知识失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/** 软删除知识 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const deleted = await deleteKnowledge(id, authResult.userId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "知识不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("删除知识失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
