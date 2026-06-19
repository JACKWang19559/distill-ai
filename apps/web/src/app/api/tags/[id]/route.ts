/**
 * 标签删除 API。
 *
 * DELETE /api/tags/[id]    删除标签
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { deleteTag } from "@/services/tag.service";

/** 删除标签 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const deleted = await deleteTag(id, session.user.id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "标签不存在" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("删除标签失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
