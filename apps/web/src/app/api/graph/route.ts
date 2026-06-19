/**
 * 知识图谱 API。
 *
 * GET /api/graph    获取图谱数据（节点 + 边 + 统计），支持过滤参数
 *
 * Query params:
 * - sourceTypes: 来源类型（逗号分隔，如 pdf,text）
 * - entityTypes: 实体类型（逗号分隔，如 person,concept）
 * - minWeight: 最小关联强度阈值（0-1，默认 0）
 * - startDate: 创建时间起始（ISO date）
 * - endDate: 创建时间截止（ISO date）
 * - limit: 最大节点数（默认 200）
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getGraphData } from "@/services/graph.service";
import type { EntityType, SourceType } from "@/lib/graph/types";

/** 合法的来源类型集合 */
const VALID_SOURCE_TYPES: SourceType[] = [
  "text",
  "markdown",
  "url",
  "pdf",
  "douyin",
  "xiaohongshu",
];

/** 合法的实体类型集合 */
const VALID_ENTITY_TYPES: EntityType[] = [
  "person",
  "concept",
  "organization",
  "technology",
  "location",
  "event",
];

/**
 * 解析逗号分隔的参数为类型安全数组。
 *
 * @param param 查询参数值
 * @param validSet 合法值集合
 * @returns 过滤后的数组（空则返回 undefined）
 */
function parseArrayParam<T extends string>(
  param: string | null,
  validSet: readonly T[]
): T[] | undefined {
  if (!param) return undefined;
  const values = param
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as T[];
  // 过滤掉不合法的值
  const filtered = values.filter((v) =>
    (validSet as readonly string[]).includes(v)
  );
  return filtered.length > 0 ? filtered : undefined;
}

/**
 * 获取图谱数据。
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "未登录" },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // 解析过滤参数
    const sourceTypes = parseArrayParam(
      searchParams.get("sourceTypes"),
      VALID_SOURCE_TYPES
    );
    const entityTypes = parseArrayParam(
      searchParams.get("entityTypes"),
      VALID_ENTITY_TYPES
    );
    const minWeightParam = searchParams.get("minWeight");
    const minWeight = minWeightParam
      ? Math.min(1, Math.max(0, parseFloat(minWeightParam)))
      : undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(500, Math.max(1, parseInt(limitParam, 10)))
      : undefined;

    const result = await getGraphData(session.user.id, {
      sourceTypes,
      entityTypes,
      minWeight,
      startDate,
      endDate,
      limit,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("获取图谱数据失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      },
      { status: 500 }
    );
  }
}
