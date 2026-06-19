/**
 * 知识库服务 - CRUD + 软删除。
 *
 * 职责：
 * 1. listKnowledge：分页查询用户知识库（支持标签/来源/时间/排序过滤）
 * 2. getKnowledge：获取单条知识详情（含标签）
 * 3. updateKnowledge：更新标题、笔记、标签
 * 4. deleteKnowledge：软删除（设置 deletedAt）
 *
 * 所有查询自动过滤 deletedAt != null 的记录。
 */

import { prisma } from "@/lib/db";
import type { KnowledgeFilterParams } from "@distill/shared";

/** 知识列表查询结果 */
export interface KnowledgeListResult {
  items: KnowledgeListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 知识列表项（精简，不含 rawContent） */
export interface KnowledgeListItem {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  distilledData: Record<string, unknown>;
  mediaMeta: unknown;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; color: string | null }>;
}

/** 知识详情（完整） */
export interface KnowledgeDetail {
  id: string;
  userId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  rawContent: string;
  distilledData: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  mediaMeta: unknown;
  userNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; color: string | null }>;
}

/** 更新知识条目输入 */
export interface UpdateKnowledgeInput {
  title?: string;
  userNote?: string;
}

/**
 * 分页查询用户知识库。
 *
 * - 自动过滤已软删除的记录（deletedAt != null）
 * - 支持标签、来源类型、时间范围、关键词过滤
 * - 支持排序（createdAt/updatedAt/title，asc/desc）
 *
 * @param userId 用户 ID
 * @param filters 过滤参数
 * @returns 分页列表
 */
export async function listKnowledge(
  userId: string,
  filters: KnowledgeFilterParams = {}
): Promise<KnowledgeListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";

  // 构建 where 条件
  const where: Record<string, unknown> = {
    userId,
    deletedAt: null,
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

  // 标签过滤（需要关联查询）
  if (filters.tagIds && filters.tagIds.length > 0) {
    where.tags = {
      some: { tagId: { in: filters.tagIds } },
    };
  }

  // 关键词搜索（标题 + 摘要）
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { rawContent: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  // 并行查询数据和总数
  const [items, total] = await Promise.all([
    prisma.knowledge.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
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
    items: items.map((item) => ({
      ...item,
      distilledData: item.distilledData as Record<string, unknown>,
      tags: item.tags.map((kt) => kt.tag),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取单条知识详情。
 *
 * @param id 知识 ID
 * @param userId 用户 ID（权限校验）
 * @returns 知识详情，不存在返回 null
 */
export async function getKnowledge(
  id: string,
  userId: string
): Promise<KnowledgeDetail | null> {
  const knowledge = await prisma.knowledge.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      tags: {
        include: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
      },
    },
  });

  if (!knowledge) return null;

  return {
    ...knowledge,
    distilledData: knowledge.distilledData as Record<string, unknown>,
    mediaMeta: knowledge.mediaMeta,
    tags: knowledge.tags.map((kt) => kt.tag),
  };
}

/**
 * 更新知识条目（标题、笔记）。
 *
 * @param id 知识 ID
 * @param userId 用户 ID
 * @param data 更新数据
 * @returns 更新后的知识，不存在返回 null
 */
export async function updateKnowledge(
  id: string,
  userId: string,
  data: UpdateKnowledgeInput
): Promise<KnowledgeDetail | null> {
  // 验证所有权
  const existing = await prisma.knowledge.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.userNote !== undefined) updateData.userNote = data.userNote;

  await prisma.knowledge.update({
    where: { id },
    data: updateData,
  });

  return getKnowledge(id, userId);
}

/**
 * 软删除知识条目（设置 deletedAt）。
 *
 * @param id 知识 ID
 * @param userId 用户 ID
 * @returns 是否删除成功
 */
export async function deleteKnowledge(
  id: string,
  userId: string
): Promise<boolean> {
  const existing = await prisma.knowledge.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!existing) return false;

  await prisma.knowledge.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return true;
}

/**
 * 获取知识条目的关联知识（图谱边）。
 *
 * @param id 知识 ID
 * @param userId 用户 ID
 * @returns 关联知识列表
 */
export async function getRelatedKnowledge(
  id: string,
  userId: string
): Promise<Array<{ id: string; title: string; weight: number; reason: string | null }>> {
  // 查询以当前知识为源或目标的关联
  const connections = await prisma.knowledgeConnection.findMany({
    where: {
      OR: [{ sourceId: id }, { targetId: id }],
    },
    include: {
      source: { select: { id: true, title: true, userId: true, deletedAt: true } },
      target: { select: { id: true, title: true, userId: true, deletedAt: true } },
    },
    orderBy: { weight: "desc" },
    take: 10,
  });

  // 过滤：只返回属于同一用户且未删除的关联知识
  return connections
    .map((conn) => {
      const related = conn.sourceId === id ? conn.target : conn.source;
      if (related.userId !== userId || related.deletedAt) return null;
      return {
        id: related.id,
        title: related.title,
        weight: conn.weight,
        reason: conn.reason,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}
