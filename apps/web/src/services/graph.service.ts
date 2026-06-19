/**
 * 知识图谱服务。
 *
 * 职责：
 * 1. calculateRelationWeight：计算两条知识的关联强度（实体共现）
 * 2. createConnections：蒸馏完成后，为新知识建立与其他知识的关联
 * 3. getGraphData：查询图谱数据（节点 + 边 + 统计），支持过滤
 *
 * 关联算法：实体共现
 * - 两条知识共享同一实体（按 name 匹配）则建立关联
 * - weight = sharedCount / min(newEntities.size, existingEntities.size)
 * - weight 范围 0-1（0 不创建边）
 */

import { prisma } from "@/lib/db";
import type {
  Entity,
  GraphEdge,
  GraphFilters,
  GraphNode,
  GraphResponse,
  SourceType,
} from "@/lib/graph/types";

/**
 * 从 distilledData 中安全提取实体列表。
 *
 * distilledData 是 Prisma Json 字段，结构为 DistillOutput。
 * 此函数只关心 entities 字段，做防御性解析。
 *
 * @param distilledData Knowledge.distilledData
 * @returns 实体列表（结构不合法时返回空数组）
 */
function extractEntities(distilledData: unknown): Entity[] {
  if (!distilledData || typeof distilledData !== "object") {
    return [];
  }
  const data = distilledData as Record<string, unknown>;
  const entities = data.entities;
  if (!Array.isArray(entities)) {
    return [];
  }
  // 过滤掉结构不合法的项
  return entities.filter(
    (e): e is Entity =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as Record<string, unknown>).name === "string" &&
      typeof (e as Record<string, unknown>).type === "string"
  );
}

/**
 * 计算两条知识的关联强度。
 *
 * 算法：weight = sharedCount / min(newSize, existingSize)
 * - 完全包含（一方实体全在另一方）：weight = 1
 * - 无共享：weight = 0
 *
 * @param newEntities 新知识的实体列表
 * @param existingEntities 已有知识的实体列表
 * @returns { weight, sharedEntities } —— weight 为 0 时 sharedEntities 为空
 */
export function calculateRelationWeight(
  newEntities: Entity[],
  existingEntities: Entity[]
): { weight: number; sharedEntities: Entity[] } {
  if (newEntities.length === 0 || existingEntities.length === 0) {
    return { weight: 0, sharedEntities: [] };
  }

  // 用 name 作为实体唯一标识（同名实体视为同一实体）
  const newNameSet = new Set(newEntities.map((e) => e.name));
  const existingNameSet = new Set(existingEntities.map((e) => e.name));

  // 求交集
  const sharedNames = [...newNameSet].filter((name) =>
    existingNameSet.has(name)
  );

  if (sharedNames.length === 0) {
    return { weight: 0, sharedEntities: [] };
  }

  // 构建共享实体列表（从 newEntities 取完整对象）
  const sharedEntities = newEntities.filter((e) =>
    sharedNames.includes(e.name)
  );

  // weight = 共享数 / min(两边实体数)
  const minSize = Math.min(newNameSet.size, existingNameSet.size);
  const weight = minSize > 0 ? sharedNames.length / minSize : 0;

  return { weight, sharedEntities };
}

/**
 * 为新知识建立与其他知识的关联。
 *
 * 蒸馏完成后调用。提取新知识的 entities，与用户所有其他知识比较，
 * 共享实体则 upsert KnowledgeConnection。
 *
 * 失败不抛出（catch + log），不影响蒸馏主流程。
 *
 * @param newKnowledgeId 新蒸馏的知识 ID
 * @param userId 用户 ID
 * @returns 创建/更新的关联数
 */
export async function createConnections(
  newKnowledgeId: string,
  userId: string
): Promise<number> {
  try {
    // 1. 查询新知识
    const newKnowledge = await prisma.knowledge.findFirst({
      where: { id: newKnowledgeId, userId, deletedAt: null },
      select: { distilledData: true },
    });

    if (!newKnowledge) {
      return 0;
    }

    const newEntities = extractEntities(newKnowledge.distilledData);

    // 新知识无实体，无法建立关联
    if (newEntities.length === 0) {
      return 0;
    }

    // 2. 查询用户所有其他知识（未软删除）的 entities
    const otherKnowledges = await prisma.knowledge.findMany({
      where: {
        userId,
        deletedAt: null,
        id: { not: newKnowledgeId },
        status: "completed",
      },
      select: { id: true, distilledData: true },
    });

    if (otherKnowledges.length === 0) {
      return 0;
    }

    // 3. 逐条计算关联并 upsert
    let connectionCount = 0;

    for (const existing of otherKnowledges) {
      const existingEntities = extractEntities(existing.distilledData);
      if (existingEntities.length === 0) {
        continue;
      }

      const { weight, sharedEntities } = calculateRelationWeight(
        newEntities,
        existingEntities
      );

      // 无共享实体，跳过
      if (weight <= 0 || sharedEntities.length === 0) {
        continue;
      }

      // 构建关联原因（最多列 5 个共享实体名）
      const reasonNames = sharedEntities.slice(0, 5).map((e) => e.name);
      const reason = `共享实体: ${reasonNames.join(", ")}`;

      // upsert：新知识为 source，已有知识为 target
      await prisma.knowledgeConnection.upsert({
        where: {
          sourceId_targetId: {
            sourceId: newKnowledgeId,
            targetId: existing.id,
          },
        },
        update: { weight, reason },
        create: {
          sourceId: newKnowledgeId,
          targetId: existing.id,
          weight,
          reason,
        },
      });

      connectionCount++;
    }

    console.log(
      `[Graph] 为知识 ${newKnowledgeId} 创建了 ${connectionCount} 条关联`
    );
    return connectionCount;
  } catch (err) {
    // 关联创建失败不影响蒸馏主流程
    console.error(
      `[Graph] createConnections 失败 (knowledge: ${newKnowledgeId}):`,
      err instanceof Error ? err.message : String(err)
    );
    return 0;
  }
}

// ============================================================================
// 图谱查询
// ============================================================================

/**
 * 查询图谱数据。
 *
 * 流程：
 * 1. 查询用户所有知识（未软删除、已完成的）作为节点候选
 * 2. 查询用户所有 KnowledgeConnection 作为边候选
 * 3. 按过滤参数过滤节点（sourceType + entityType + dateRange）
 * 4. 按过滤参数过滤边（minWeight + 两端节点都在过滤后节点集中）
 * 5. 若节点数 > limit，按度中心性（关联数）降序截断
 *
 * @param userId 用户 ID
 * @param filters 过滤参数
 * @returns 图谱响应（nodes + edges + stats）
 */
export async function getGraphData(
  userId: string,
  filters: GraphFilters = {}
): Promise<GraphResponse> {
  const sourceTypes = filters.sourceTypes ?? [];
  const entityTypes = filters.entityTypes ?? [];
  const minWeight = filters.minWeight ?? 0;
  const limit = filters.limit ?? 200;

  // 1. 查询用户所有知识（未软删除、已完成）
  const knowledges = await prisma.knowledge.findMany({
    where: {
      userId,
      deletedAt: null,
      status: "completed",
    },
    select: {
      id: true,
      title: true,
      sourceType: true,
      distilledData: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. 查询用户所有关联
  // 关联的两端必须都属于该用户（通过 Knowledge.userId 校验）
  const connections = await prisma.knowledgeConnection.findMany({
    where: {
      OR: [
        { source: { userId } },
        { target: { userId } },
      ],
    },
    include: {
      source: {
        select: { id: true, userId: true, deletedAt: true, distilledData: true },
      },
      target: {
        select: { id: true, userId: true, deletedAt: true, distilledData: true },
      },
    },
  });

  // 3. 构建节点候选（带 entities）
  const allNodes: GraphNode[] = knowledges.map((k) => {
    const entities = extractEntities(k.distilledData);
    return {
      id: k.id,
      title: k.title,
      sourceType: k.sourceType as SourceType,
      entityCount: entities.length,
      entities,
      createdAt: k.createdAt.toISOString(),
    };
  });

  // 4. 过滤节点
  let filteredNodes = allNodes.filter((node) => {
    // 来源类型过滤
    if (sourceTypes.length > 0 && !sourceTypes.includes(node.sourceType)) {
      return false;
    }

    // 实体类型过滤（节点至少有一个实体类型在选中集合中）
    if (entityTypes.length > 0) {
      const hasEntityType = node.entities.some((e) =>
        entityTypes.includes(e.type)
      );
      if (!hasEntityType) {
        return false;
      }
    }

    // 时间范围过滤
    const nodeDate = new Date(node.createdAt);
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      if (nodeDate < start) return false;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      // endDate 设为当天结束（23:59:59）
      end.setHours(23, 59, 59, 999);
      if (nodeDate > end) return false;
    }

    return true;
  });

  // 5. 构建过滤后节点 ID 集合
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  // 6. 构建边（提取共享实体）
  const allEdges: GraphEdge[] = [];
  for (const conn of connections) {
    // 两端都必须在过滤后节点集中
    if (!filteredNodeIds.has(conn.sourceId) || !filteredNodeIds.has(conn.targetId)) {
      continue;
    }

    // minWeight 过滤
    if (conn.weight < minWeight) {
      continue;
    }

    // 提取共享实体（从两端 distilledData 的 entities 取交集）
    const sourceEntities = extractEntities(conn.source.distilledData);
    const targetEntities = extractEntities(conn.target.distilledData);
    const targetNames = new Set(targetEntities.map((e) => e.name));
    const sharedEntities = sourceEntities.filter((e) =>
      targetNames.has(e.name)
    );

    allEdges.push({
      source: conn.sourceId,
      target: conn.targetId,
      weight: conn.weight,
      sharedEntities,
    });
  }

  // 7. 若节点数 > limit，按度中心性截断
  let finalNodes = filteredNodes;
  let finalEdges = allEdges;
  if (filteredNodes.length > limit) {
    // 计算每个节点的度（关联数）
    const degreeMap = new Map<string, number>();
    for (const edge of allEdges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }

    // 按度降序排序，取前 limit 个
    const keptNodeIds = new Set(
      [...filteredNodes]
        .sort(
          (a, b) =>
            (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0)
        )
        .slice(0, limit)
        .map((n) => n.id)
    );

    finalNodes = filteredNodes.filter((n) => keptNodeIds.has(n.id));
    // 边的两端都必须在保留节点集中
    finalEdges = allEdges.filter(
      (e) => keptNodeIds.has(e.source) && keptNodeIds.has(e.target)
    );
  }

  return {
    nodes: finalNodes,
    edges: finalEdges,
    stats: {
      totalNodes: allNodes.length,
      totalEdges: connections.length,
      filteredNodes: finalNodes.length,
      filteredEdges: finalEdges.length,
    },
  };
}
