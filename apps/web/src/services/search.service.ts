/**
 * 搜索服务 - ILIKE 全文搜索 + 过滤。
 *
 * 职责：
 * 1. search：在标题和原始内容中搜索（ILIKE 不区分大小写）
 * 2. 支持标签、来源类型、时间范围过滤
 * 3. 返回结果含匹配摘要（用于前端高亮）
 *
 * 注：当前使用 PostgreSQL ILIKE，简单高效。
 * Phase 7 可升级为 tsvector 全文索引或 pg_trgm 相似度搜索。
 */

import { prisma } from "@/lib/db";
import type { KnowledgeListItem } from "./knowledge.service";

/** 搜索结果项（含匹配片段） */
export interface SearchResultItem extends KnowledgeListItem {
  /** 匹配片段（用于前端高亮显示） */
  snippet: string;
}

/** 搜索结果 */
export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
}

/** 搜索过滤参数 */
export interface SearchFilters {
  q: string;
  tagIds?: string[];
  sourceTypes?: string[];
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/** 摘要片段最大长度 */
const SNIPPET_MAX_LENGTH = 200;
/** 摘要片段前后保留字符数 */
const SNIPPET_PADDING = 80;

/**
 * 搜索用户知识库。
 *
 * 搜索范围：title + rawContent（ILIKE 不区分大小写）
 * 过滤：标签、来源类型、时间范围
 *
 * @param userId 用户 ID
 * @param filters 搜索过滤参数
 * @returns 搜索结果
 */
export async function search(
  userId: string,
  filters: SearchFilters
): Promise<SearchResult> {
  const { q } = filters;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));

  if (!q || !q.trim()) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      query: q,
    };
  }

  const query = q.trim();

  // 构建 where 条件
  const where: Record<string, unknown> = {
    userId,
    deletedAt: null,
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { rawContent: { contains: query, mode: "insensitive" } },
    ],
  };

  // 来源类型过滤
  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    where.sourceType = { in: filters.sourceTypes };
  }

  // 时间范围过滤
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(filters.endDate);
    }
  }

  // 标签过滤
  if (filters.tagIds && filters.tagIds.length > 0) {
    where.tags = {
      some: { tagId: { in: filters.tagIds } },
    };
  }

  // 并行查询
  const [items, total] = await Promise.all([
    prisma.knowledge.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        status: true,
        distilledData: true,
        mediaMeta: true,
        rawContent: true,
        createdAt: true,
        updatedAt: true,
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    }),
    prisma.knowledge.count({ where }),
  ]);

  return {
    items: items.map((item) => {
      const { rawContent, ...rest } = item;
      return {
        ...rest,
        distilledData: item.distilledData as Record<string, unknown>,
        tags: item.tags.map((kt) => kt.tag),
        snippet: extractSnippet(rawContent, query),
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    query,
  };
}

/**
 * 从原始内容中提取匹配片段（用于前端高亮）。
 *
 * 找到查询词首次出现的位置，截取前后各 80 字符。
 *
 * @param content 原始内容
 * @param query 查询词
 * @returns 匹配片段
 */
function extractSnippet(content: string, query: string): string {
  if (!content) return "";

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    // 未在内容中找到（可能在标题中匹配），返回内容开头
    return content.slice(0, SNIPPET_MAX_LENGTH) + (content.length > SNIPPET_MAX_LENGTH ? "..." : "");
  }

  const start = Math.max(0, matchIndex - SNIPPET_PADDING);
  const end = Math.min(content.length, matchIndex + query.length + SNIPPET_PADDING);

  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  return prefix + content.slice(start, end) + suffix;
}
