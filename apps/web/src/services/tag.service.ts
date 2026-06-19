/**
 * 标签服务 - CRUD + 知识关联。
 *
 * 职责：
 * 1. listTags：获取用户所有标签（含关联知识数）
 * 2. createTag：创建标签（同用户下名称唯一）
 * 3. deleteTag：删除标签（级联删除关联）
 * 4. attachTags：为知识条目附加标签
 * 5. detachTags：移除知识条目的标签
 * 6. updateTags：替换知识条目的标签（全量覆盖）
 */

import { prisma } from "@/lib/db";

/** 标签列表项（含关联知识数） */
export interface TagWithCount {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
  /** 关联的知识条目数 */
  count: number;
}

/** 创建标签输入 */
export interface CreateTagInput {
  name: string;
  color?: string;
}

/**
 * 获取用户所有标签（按名称排序，含关联知识数）。
 *
 * @param userId 用户 ID
 * @returns 标签列表
 */
export async function listTags(userId: string): Promise<TagWithCount[]> {
  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { knowledge: true },
      },
    },
  });

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
    count: tag._count.knowledge,
  }));
}

/**
 * 创建标签。
 *
 * 同用户下标签名称唯一，重复创建会抛出错误。
 *
 * @param userId 用户 ID
 * @param input 创建输入（name 必填，color 可选）
 * @returns 创建的标签
 * @throws 如果标签名已存在
 */
export async function createTag(
  userId: string,
  input: CreateTagInput
): Promise<{ id: string; name: string; color: string | null; createdAt: Date }> {
  // 检查是否已存在
  const existing = await prisma.tag.findUnique({
    where: { userId_name: { userId, name: input.name } },
  });
  if (existing) {
    throw new Error(`标签 "${input.name}" 已存在`);
  }

  return prisma.tag.create({
    data: {
      userId,
      name: input.name,
      color: input.color ?? null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  });
}

/**
 * 删除标签。
 * 级联删除 KnowledgeTag 关联（Prisma schema 中已配置 onDelete: Cascade）。
 *
 * @param id 标签 ID
 * @param userId 用户 ID（权限校验）
 * @returns 是否删除成功
 */
export async function deleteTag(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.tag.findFirst({
    where: { id, userId },
  });
  if (!existing) return false;

  await prisma.tag.delete({ where: { id } });
  return true;
}

/**
 * 为知识条目附加标签（增量添加，忽略已存在的）。
 *
 * @param knowledgeId 知识 ID
 * @param tagIds 标签 ID 列表
 */
export async function attachTags(
  knowledgeId: string,
  tagIds: string[]
): Promise<void> {
  if (tagIds.length === 0) return;

  // 批量创建关联，忽略唯一约束冲突
  await Promise.all(
    tagIds.map((tagId) =>
      prisma.knowledgeTag
        .create({ data: { knowledgeId, tagId } })
        .catch(() => {
          /* 唯一约束冲突 → 忽略 */
        })
    )
  );
}

/**
 * 移除知识条目的指定标签。
 *
 * @param knowledgeId 知识 ID
 * @param tagIds 标签 ID 列表
 */
export async function detachTags(
  knowledgeId: string,
  tagIds: string[]
): Promise<void> {
  if (tagIds.length === 0) return;

  await prisma.knowledgeTag.deleteMany({
    where: {
      knowledgeId,
      tagId: { in: tagIds },
    },
  });
}

/**
 * 替换知识条目的标签（全量覆盖）。
 *
 * 先删除所有现有关联，再添加新的关联。
 *
 * @param knowledgeId 知识 ID
 * @param tagIds 新的标签 ID 列表（全量）
 */
export async function updateTags(
  knowledgeId: string,
  tagIds: string[]
): Promise<void> {
  await prisma.$transaction([
    // 删除所有现有关联
    prisma.knowledgeTag.deleteMany({
      where: { knowledgeId },
    }),
    // 添加新关联
    ...tagIds.map((tagId) =>
      prisma.knowledgeTag.create({
        data: { knowledgeId, tagId },
      })
    ),
  ]);
}
