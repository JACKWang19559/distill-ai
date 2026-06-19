/**
 * 搜索 API。
 *
 * GET /api/search    搜索知识库（ILIKE 全文搜索 + 过滤）
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { search } from "@/services/search.service";

/**
 * 搜索知识库。
 *
 * Query params:
 * - q: 搜索关键词（必填）
 * - tagIds: 标签 ID（逗号分隔）
 * - sourceTypes: 来源类型（逗号分隔）
 * - startDate / endDate: 时间范围
 * - page / pageSize: 分页
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "搜索关键词不能为空" } },
        { status: 400 }
      );
    }

    const tagIdsParam = searchParams.get("tagIds");
    const sourceTypesParam = searchParams.get("sourceTypes");

    const result = await search(session.user.id, {
      q,
      tagIds: tagIdsParam ? tagIdsParam.split(",") : undefined,
      sourceTypes: sourceTypesParam ? sourceTypesParam.split(",") : undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 12,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("搜索失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
