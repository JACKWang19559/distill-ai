/**
 * 知识库列表 API。
 *
 * GET /api/knowledge    获取用户知识库列表（分页 + 过滤）
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { listKnowledge } from "@/services/knowledge.service";

/**
 * 获取知识库列表。
 *
 * Query params:
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 12）
 * - q: 搜索关键词
 * - tagIds: 标签 ID（逗号分隔）
 * - sourceTypes: 来源类型（逗号分隔）
 * - startDate / endDate: 时间范围
 * - sortBy: 排序字段（createdAt/updatedAt/title）
 * - sortOrder: 排序方向（asc/desc）
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

    // 解析过滤参数
    const tagIdsParam = searchParams.get("tagIds");
    const sourceTypesParam = searchParams.get("sourceTypes");

    const result = await listKnowledge(session.user.id, {
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 12,
      q: searchParams.get("q") || undefined,
      tagIds: tagIdsParam ? tagIdsParam.split(",") : undefined,
      sourceTypes: sourceTypesParam ? sourceTypesParam.split(",") : undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      sortBy: (searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title") || undefined,
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("获取知识库列表失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
