# Phase 5: 知识图谱实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现知识图谱功能——蒸馏完成后基于实体共现自动建立知识关联，提供力导向可视化与多维过滤，帮助用户发现知识间的隐藏联系。

**Architecture:** 三层架构——Service 层（`graph.service.ts`）负责关联计算与图谱查询；API 层（`GET /api/graph`）返回 `{ nodes, edges, stats }`；UI 层用 `@xyflow/react` + `d3-force` 渲染力导向图谱，配几何图标节点与过滤面板。关联在蒸馏完成后自动触发（实体共现算法）。

**Tech Stack:** Next.js 16 App Router, Prisma 7, @xyflow/react v12, d3-force v3, Tailwind CSS 4, shadcn/ui, TypeScript 5

**关联设计文档:** [2026-06-18-phase5-knowledge-graph-design.md](./2026-06-18-phase5-knowledge-graph-design.md)

**验证方式:** 本项目未配置测试框架，每个任务用 `pnpm typecheck` + 手动浏览器测试验证。所有命令在 `apps/web` 目录下执行。

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `apps/web/src/lib/graph/types.ts` | 图谱类型定义（GraphNode/GraphEdge/GraphResponse/GraphFilters） |
| `apps/web/src/services/graph.service.ts` | 关联计算（createConnections）+ 图谱查询（getGraphData） |
| `apps/web/src/app/api/graph/route.ts` | GET /api/graph 端点 |
| `apps/web/src/components/graph/GraphNode.tsx` | 自定义节点组件（几何图标 + 标签） |
| `apps/web/src/components/graph/GraphEdge.tsx` | 自定义边组件（粗细映射 weight + tooltip） |
| `apps/web/src/components/graph/GraphControls.tsx` | 控制面板（缩放/重置）+ 过滤面板（4 维过滤） |
| `apps/web/src/components/graph/KnowledgeGraph.tsx` | 图谱主组件（d3-force 布局 + ReactFlow 渲染） |
| `apps/web/src/lib/graph/icons.tsx` | 几何图标 SVG 组件（非 emoji） |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `apps/web/src/services/distill.service.ts` | 蒸馏完成后调用 `createConnections()` |
| `apps/web/src/app/(dashboard)/graph/page.tsx` | 替换占位页为图谱客户端组件 |
| `apps/web/package.json` | 添加 `@xyflow/react`、`d3-force`、`@types/d3-force` 依赖 |

---

## Task 1: 安装依赖 + 定义图谱类型

**Files:**
- Create: `apps/web/src/lib/graph/types.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装依赖**

Run（在 `apps/web` 目录）:
```bash
pnpm add @xyflow/react@^12 d3-force@^3
pnpm add -D @types/d3-force@^3
```

Expected: `package.json` 中出现 `@xyflow/react`、`d3-force`、`@types/d3-force` 三个依赖。

- [ ] **Step 2: 创建类型定义文件**

Create `apps/web/src/lib/graph/types.ts`:

```typescript
/**
 * 知识图谱类型定义。
 *
 * 定义图谱的节点、边、响应结构与过滤参数。
 * 被 graph.service.ts、api/graph/route.ts、图谱 UI 组件共用。
 */

/** 来源类型（与 Knowledge.sourceType 对应） */
export type SourceType =
  | "text"
  | "markdown"
  | "url"
  | "pdf"
  | "douyin"
  | "xiaohongshu";

/** 实体类型（与 prompts.ts entityTypeSchema 对应） */
export type EntityType =
  | "person"
  | "concept"
  | "organization"
  | "technology"
  | "location"
  | "event";

/** 实体结构（与 distilledData.entities 元素对应） */
export interface Entity {
  /** 实体名称 */
  name: string;
  /** 实体类型 */
  type: EntityType;
}

/** 图谱节点（对应一条 Knowledge） */
export interface GraphNode {
  /** 知识 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 来源类型 */
  sourceType: SourceType;
  /** 实体总数 */
  entityCount: number;
  /** 实体列表（用于过滤与展示） */
  entities: Entity[];
  /** 创建时间（ISO 字符串） */
  createdAt: string;
}

/** 图谱边（对应一条 KnowledgeConnection） */
export interface GraphEdge {
  /** 源知识 ID */
  source: string;
  /** 目标知识 ID */
  target: string;
  /** 关联强度 0-1 */
  weight: number;
  /** 共享实体列表 */
  sharedEntities: Entity[];
}

/** 图谱响应 */
export interface GraphResponse {
  /** 过滤后的节点列表 */
  nodes: GraphNode[];
  /** 过滤后的边列表 */
  edges: GraphEdge[];
  /** 统计信息 */
  stats: {
    /** 用户总知识数 */
    totalNodes: number;
    /** 用户总关联数 */
    totalEdges: number;
    /** 过滤后节点数 */
    filteredNodes: number;
    /** 过滤后边数 */
    filteredEdges: number;
  };
}

/** 图谱查询过滤参数 */
export interface GraphFilters {
  /** 来源类型过滤（空数组=全部） */
  sourceTypes?: SourceType[];
  /** 实体类型过滤（空数组=全部） */
  entityTypes?: EntityType[];
  /** 最小关联强度阈值（0-1，默认 0） */
  minWeight?: number;
  /** 创建时间起始（ISO date） */
  startDate?: string;
  /** 创建时间截止（ISO date） */
  endDate?: string;
  /** 最大节点数（防止过大，默认 200） */
  limit?: number;
}
```

- [ ] **Step 3: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

---

## Task 2: 图谱服务 — 关联计算

**Files:**
- Create: `apps/web/src/services/graph.service.ts`

- [ ] **Step 1: 创建图谱服务文件（关联计算部分）**

Create `apps/web/src/services/graph.service.ts`:

```typescript
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
    const newNameSet = new Set(newEntities.map((e) => e.name));

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
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。若报 `sourceId_targetId` 不存在，改为 `sourceId_targetId` 是 Prisma 复合唯一约束的标准命名（`@@unique([sourceId, targetId])` → `sourceId_targetId`）。

---

## Task 3: 图谱服务 — 图谱查询

**Files:**
- Modify: `apps/web/src/services/graph.service.ts`（追加 `getGraphData` 函数）

- [ ] **Step 1: 在 graph.service.ts 末尾追加 getGraphData 函数**

在 `apps/web/src/services/graph.service.ts` 文件末尾追加：

```typescript

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
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

---

## Task 4: 集成关联创建到蒸馏服务

**Files:**
- Modify: `apps/web/src/services/distill.service.ts`

- [ ] **Step 1: 在 distill.service.ts 顶部添加 import**

在 `apps/web/src/services/distill.service.ts` 的 import 区域（第 29 行 `import { distillPdfInChunks } from "@/lib/extractor/pdf";` 之后）添加：

```typescript
import { createConnections } from "@/services/graph.service";
```

- [ ] **Step 2: 在蒸馏成功后调用 createConnections**

在 `apps/web/src/services/distill.service.ts` 的 `processDistillTask` 函数中，找到创建标签的代码（约第 191 行）：

```typescript
    // 6. 创建推荐标签
    await createTagsFromDistill(task.userId, knowledge.id, distilled);
```

在其后添加：

```typescript

    // 6.5 创建知识图谱关联（实体共现）
    // 失败不影响蒸馏主流程（createConnections 内部已 catch）
    await createConnections(knowledge.id, task.userId);
```

- [ ] **Step 3: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

---

## Task 5: 图谱 API 端点

**Files:**
- Create: `apps/web/src/app/api/graph/route.ts`

- [ ] **Step 1: 创建 API 路由**

Create `apps/web/src/app/api/graph/route.ts`:

```typescript
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
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 3: 手动测试 API**

确保 Next.js dev server 运行中（`pnpm dev`），浏览器登录后访问：
```
http://localhost:3000/api/graph
```

Expected: 返回 `{ success: true, data: { nodes: [...], edges: [...], stats: {...} } }`。
若知识库有已完成的知识，nodes 应非空；若知识间有共享实体，edges 应非空。

---

## Task 6: 几何图标组件

**Files:**
- Create: `apps/web/src/lib/graph/icons.tsx`

- [ ] **Step 1: 创建几何图标 SVG 组件**

Create `apps/web/src/lib/graph/icons.tsx`:

```typescript
/**
 * 知识图谱几何图标组件。
 *
 * 使用 SVG 绘制简笔几何图形（非 emoji），代表不同来源类型。
 * 所有图标接受 size 和 color 属性，stroke 风格统一。
 */

/** 图标属性 */
interface IconProps {
  /** 图标尺寸（px） */
  size?: number;
  /** 描边颜色 */
  color?: string;
  /** 描边宽度 */
  strokeWidth?: number;
}

/** 默认属性 */
const DEFAULT_PROPS = {
  size: 20,
  color: "currentColor",
  strokeWidth: 2,
};

/** 方形图标（PDF） */
export function SquareIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={-r}
        y={-r}
        width={r * 2}
        height={r * 2}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/** 圆形图标（Text/Markdown） */
export function CircleIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** 菱形图标（URL） */
export function DiamondIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 三角形图标（Douyin） */
export function TriangleIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  // 等边三角形，顶点朝上
  const h = r * Math.sqrt(3) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M 0 ${-r} L ${h} ${r / 2} L ${-h} ${r / 2} Z`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 六边形图标（Xiaohongshu） */
export function HexagonIcon({
  size = DEFAULT_PROPS.size,
  color = DEFAULT_PROPS.color,
  strokeWidth = DEFAULT_PROPS.strokeWidth,
}: IconProps) {
  const half = size / 2;
  const r = half - strokeWidth / 2;
  // 正六边形，顶点朝左右
  const h = r * Math.sqrt(3) / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${half} -${half} ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M ${-r} 0 L ${-h} ${-r / 2} L ${h} ${-r / 2} L ${r} 0 L ${h} ${r / 2} L ${-h} ${r / 2} Z`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 来源类型 → 图标 + 颜色配置 */
export const SOURCE_VISUAL_CONFIG: Record<
  string,
  { Icon: typeof SquareIcon; color: string; label: string }
> = {
  pdf: { Icon: SquareIcon, color: "#3b82f6", label: "PDF" },
  text: { Icon: CircleIcon, color: "#8b5cf6", label: "文本" },
  markdown: { Icon: CircleIcon, color: "#8b5cf6", label: "Markdown" },
  url: { Icon: DiamondIcon, color: "#10b981", label: "网页" },
  douyin: { Icon: TriangleIcon, color: "#ec4899", label: "抖音" },
  xiaohongshu: { Icon: HexagonIcon, color: "#f59e0b", label: "小红书" },
};
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

---

## Task 7: 自定义节点组件

**Files:**
- Create: `apps/web/src/components/graph/GraphNode.tsx`

- [ ] **Step 1: 创建 GraphNode 组件**

Create `apps/web/src/components/graph/GraphNode.tsx`:

```typescript
/**
 * GraphNode - 知识图谱自定义节点组件。
 *
 * 视觉属性：
 * - 大小：度中心性映射（24-48px），关联越多越大
 * - 图标：来源类型对应的几何图形（SVG，非 emoji）
 * - 颜色：来源类型对应的颜色（border + 图标 stroke）
 * - 标签：标题，截断 15 字符，显示在节点下方
 * - 悬停：显示完整标题 tooltip
 *
 * 点击节点跳转到知识详情页。
 */

"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { SOURCE_VISUAL_CONFIG } from "@/lib/graph/icons";
import type { GraphNode as GraphNodeType } from "@/lib/graph/types";

/** 节点 data 结构（从 GraphNode 转换而来，附带 degree） */
export interface KnowledgeNodeData {
  /** 知识 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 来源类型 */
  sourceType: string;
  /** 度中心性（关联数） */
  degree: number;
  /** 创建时间 */
  createdAt: string;
  /** 原始 record（用于 tooltip） */
  [key: string]: unknown;
}

/** React Flow 节点类型 */
export type KnowledgeFlowNode = NodeProps & {
  data: KnowledgeNodeData;
};

/** 最小节点尺寸 */
const MIN_SIZE = 24;
/** 最大节点尺寸 */
const MAX_SIZE = 48;
/** 最大度（用于归一化，超过此值按最大尺寸） */
const MAX_DEGREE = 10;

/**
 * 根据度中心性计算节点尺寸。
 *
 * @param degree 度（关联数）
 * @returns 节点尺寸（px）
 */
function calcNodeSize(degree: number): number {
  if (degree <= 0) return MIN_SIZE;
  const ratio = Math.min(degree / MAX_DEGREE, 1);
  return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * ratio;
}

/**
 * 截断标题到指定长度。
 *
 * @param title 原始标题
 * @param maxLen 最大长度（默认 15）
 * @returns 截断后的标题
 */
function truncateTitle(title: string, maxLen = 15): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "…";
}

/**
 * 知识图谱节点组件。
 */
function GraphNodeComponent({ data }: KnowledgeFlowNode) {
  const config =
    SOURCE_VISUAL_CONFIG[data.sourceType] ?? SOURCE_VISUAL_CONFIG.text;
  const { Icon, color } = config;
  const size = calcNodeSize(data.degree);
  const truncatedTitle = truncateTitle(data.title);

  return (
    <div
      className="relative flex flex-col items-center cursor-pointer group"
      title={`${data.title}\n来源: ${config.label}\n关联数: ${data.degree}\n创建: ${new Date(data.createdAt).toLocaleDateString("zh-CN")}`}
    >
      {/* 连接点（上下左右） */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 1, height: 1 }}
      />

      {/* 节点圆形容器 */}
      <div
        className="flex items-center justify-center rounded-full bg-background transition-all group-hover:shadow-lg"
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}`,
          boxShadow: `0 0 0 2px ${color}20`,
        }}
      >
        <Icon size={size * 0.5} color={color} strokeWidth={2} />
      </div>

      {/* 标题标签 */}
      <div
        className="mt-1 max-w-[120px] truncate text-center text-xs text-foreground/80"
        style={{ fontSize: 11 }}
      >
        {truncatedTitle}
      </div>
    </div>
  );
}

export const GraphNode = memo(GraphNodeComponent);
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。若 `NodeProps` 报错，确认 `@xyflow/react` v12 已安装。

---

## Task 8: 自定义边组件

**Files:**
- Create: `apps/web/src/components/graph/GraphEdge.tsx`

- [ ] **Step 1: 创建 GraphEdge 组件**

Create `apps/web/src/components/graph/GraphEdge.tsx`:

```typescript
/**
 * GraphEdge - 知识图谱自定义边组件。
 *
 * 视觉属性：
 * - 粗细：weight 映射（0.5px-3px）
 * - 透明度：weight 映射（0.2-0.8）
 * - 颜色：灰色 #333
 * - 悬停：显示共享实体列表 tooltip
 */

"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

/** 边的 data 结构 */
export interface KnowledgeEdgeData {
  /** 关联强度 0-1 */
  weight: number;
  /** 共享实体名称列表 */
  sharedEntityNames: string[];
  [key: string]: unknown;
}

/** 最小边宽 */
const MIN_STROKE = 0.5;
/** 最大边宽 */
const MAX_STROKE = 3;
/** 最小透明度 */
const MIN_OPACITY = 0.2;
/** 最大透明度 */
const MAX_OPACITY = 0.8;

/**
 * 根据 weight 计算边宽。
 *
 * @param weight 关联强度 0-1
 * @returns 边宽（px）
 */
function calcStrokeWidth(weight: number): number {
  return MIN_STROKE + (MAX_STROKE - MIN_STROKE) * weight;
}

/**
 * 根据 weight 计算透明度。
 *
 * @param weight 关联强度 0-1
 * @returns 透明度 0-1
 */
function calcOpacity(weight: number): number {
  return MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * weight;
}

/**
 * 知识图谱边组件。
 */
function GraphEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const edgeData = (data ?? {}) as KnowledgeEdgeData;
  const weight = edgeData.weight ?? 0;
  const sharedNames = edgeData.sharedEntityNames ?? [];

  const strokeWidth = calcStrokeWidth(weight);
  const opacity = calcOpacity(weight);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* 可见的边路径 */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "#333",
          strokeWidth,
          opacity: isHovered ? 1 : opacity,
          transition: "opacity 0.2s",
        }}
      />
      {/* 透明的宽路径用于捕获悬停事件 */}
      <BaseEdge
        id={`${id}-hitbox`}
        path={edgePath}
        style={{
          stroke: "transparent",
          strokeWidth: 20,
          cursor: "pointer",
        }}
        interactionWidth={20}
      />
      {/* 悬停时显示共享实体 tooltip */}
      <EdgeLabelRenderer>
        {isHovered && sharedNames.length > 0 && (
          <div
            className="absolute pointer-events-none rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              maxWidth: 240,
              zIndex: 10,
            }}
          >
            <div className="font-medium mb-1">
              关联强度: {(weight * 100).toFixed(0)}%
            </div>
            <div className="text-muted-foreground">
              共享实体: {sharedNames.join("、")}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
      {/* 悬停事件捕获层 */}
      <EdgeLabelRenderer>
        <div
          className="absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            width: 40,
            height: 40,
            cursor: "pointer",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      </EdgeLabelRenderer>
    </>
  );
}

export const GraphEdge = memo(GraphEdgeComponent);
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

---

## Task 9: 控制面板 + 过滤面板

**Files:**
- Create: `apps/web/src/components/graph/GraphControls.tsx`

- [ ] **Step 1: 创建 GraphControls 组件**

Create `apps/web/src/components/graph/GraphControls.tsx`:

```typescript
/**
 * GraphControls - 知识图谱控制面板 + 过滤面板。
 *
 * 两部分：
 * 1. 控制面板（右上角浮动）：缩放、缩小、重置视图、重新布局
 * 2. 过滤面板（左侧浮动）：来源类型、关联强度、实体类型、时间范围
 *
 * 过滤参数变化时调用 onFiltersChange，由父组件重新 fetch 数据。
 */

"use client";

import { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Shuffle,
  Filter,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SOURCE_VISUAL_CONFIG } from "@/lib/graph/icons";
import type { EntityType, SourceType } from "@/lib/graph/types";

/** 过滤参数 */
export interface GraphFilterState {
  sourceTypes: SourceType[];
  entityTypes: EntityType[];
  minWeight: number;
  startDate: string;
  endDate: string;
}

/** 默认过滤参数（无过滤） */
export const DEFAULT_FILTERS: GraphFilterState = {
  sourceTypes: [],
  entityTypes: [],
  minWeight: 0,
  startDate: "",
  endDate: "",
};

/** 来源类型选项 */
const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "text", label: "文本" },
  { value: "markdown", label: "Markdown" },
  { value: "url", label: "网页" },
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
];

/** 实体类型选项 */
const ENTITY_TYPE_OPTIONS: Array<{ value: EntityType; label: string }> = [
  { value: "person", label: "人物" },
  { value: "concept", label: "概念" },
  { value: "organization", label: "组织" },
  { value: "technology", label: "技术" },
  { value: "location", label: "地点" },
  { value: "event", label: "事件" },
];

/** GraphControls 属性 */
interface GraphControlsProps {
  /** 当前过滤参数 */
  filters: GraphFilterState;
  /** 过滤参数变更回调 */
  onFiltersChange: (filters: GraphFilterState) => void;
  /** 缩小 */
  onZoomIn: () => void;
  /** 放大 */
  onZoomOut: () => void;
  /** 重置视图（fitView） */
  onFitView: () => void;
  /** 重新布局 */
  onRelayout: () => void;
}

/**
 * 知识图谱控制面板 + 过滤面板。
 */
export function GraphControls({
  filters,
  onFiltersChange,
  onZoomIn,
  onZoomOut,
  onFitView,
  onRelayout,
}: GraphControlsProps) {
  const [showFilters, setShowFilters] = useState(true);

  /** 切换来源类型选中 */
  const toggleSourceType = (type: SourceType) => {
    const next = filters.sourceTypes.includes(type)
      ? filters.sourceTypes.filter((t) => t !== type)
      : [...filters.sourceTypes, type];
    onFiltersChange({ ...filters, sourceTypes: next });
  };

  /** 切换实体类型选中 */
  const toggleEntityType = (type: EntityType) => {
    const next = filters.entityTypes.includes(type)
      ? filters.entityTypes.filter((t) => t !== type)
      : [...filters.entityTypes, type];
    onFiltersChange({ ...filters, entityTypes: next });
  };

  /** 重置所有过滤 */
  const resetFilters = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
  };

  /** 是否有过滤条件 */
  const hasFilters =
    filters.sourceTypes.length > 0 ||
    filters.entityTypes.length > 0 ||
    filters.minWeight > 0 ||
    filters.startDate !== "" ||
    filters.endDate !== "";

  return (
    <>
      {/* 控制按钮组（右上角） */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-1 rounded-lg border bg-background/80 p-1 shadow-sm backdrop-blur">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn} title="放大">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut} title="缩小">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitView} title="重置视图">
          <Maximize className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRelayout} title="重新布局">
          <Shuffle className="h-4 w-4" />
        </Button>
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowFilters(!showFilters)}
          title="过滤面板"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* 过滤面板（左侧） */}
      {showFilters && (
        <div className="absolute left-4 top-4 z-10 w-64 rounded-lg border bg-background/95 p-4 shadow-md backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">过滤</h3>
            <div className="flex items-center gap-1">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={resetFilters}
                  title="重置过滤"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowFilters(false)}
                title="收起"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* 来源类型 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                来源类型
              </label>
              <div className="flex flex-wrap gap-1">
                {SOURCE_TYPE_OPTIONS.map((option) => {
                  const config = SOURCE_VISUAL_CONFIG[option.value];
                  const isSelected = filters.sourceTypes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleSourceType(option.value)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      )}
                    >
                      <config.Icon size={10} color={isSelected ? "currentColor" : config.color} strokeWidth={2.5} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 关联强度阈值 */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>关联强度</span>
                <span className="tabular-nums">
                  ≥ {(filters.minWeight * 100).toFixed(0)}%
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={filters.minWeight}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minWeight: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-primary"
              />
            </div>

            {/* 实体类型 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                实体类型
              </label>
              <div className="flex flex-wrap gap-1">
                {ENTITY_TYPE_OPTIONS.map((option) => {
                  const isSelected = filters.entityTypes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleEntityType(option.value)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 时间范围 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                时间范围
              </label>
              <div className="space-y-1.5">
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, startDate: e.target.value })
                  }
                  className="h-8 text-xs"
                />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, endDate: e.target.value })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

---

## Task 10: 图谱主组件

**Files:**
- Create: `apps/web/src/components/graph/KnowledgeGraph.tsx`

- [ ] **Step 1: 创建 KnowledgeGraph 主组件**

Create `apps/web/src/components/graph/KnowledgeGraph.tsx`:

```typescript
/**
 * KnowledgeGraph - 知识图谱主组件。
 *
 * 职责：
 * 1. 从 GET /api/graph 获取图谱数据（带过滤参数）
 * 2. 用 d3-force 计算力导向布局
 * 3. 用 @xyflow/react 渲染图谱（自定义节点 + 边）
 * 4. 提供缩放、重置、重新布局、过滤交互
 *
 * 数据流：
 *   filters 变化 → fetch /api/graph → 转换为 ReactFlow nodes/edges
 *   → d3-force 布局计算 → 更新节点位置 → ReactFlow 渲染
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { Loader2, AlertCircle, Inbox, RefreshCw, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraphNode, type KnowledgeNodeData } from "./GraphNode";
import { GraphEdge, type KnowledgeEdgeData } from "./GraphEdge";
import {
  GraphControls,
  DEFAULT_FILTERS,
  type GraphFilterState,
} from "./GraphControls";
import type { GraphResponse } from "@/lib/graph/types";

/** d3-force 节点类型（带 x, y 坐标） */
interface ForceNode extends SimulationNodeDatum {
  id: string;
  data: KnowledgeNodeData;
}

/** d3-force 边类型 */
interface ForceLink {
  source: string;
  target: string;
  weight: number;
  sharedEntityNames: string[];
}

/** React Flow 节点类型 */
type FlowNode = Node<KnowledgeNodeData>;
/** React Flow 边类型 */
type FlowEdge = Edge<KnowledgeEdgeData>;

/** 节点类型注册 */
const nodeTypes = { knowledge: GraphNode };
/** 边类型注册 */
const edgeTypes = { knowledge: GraphEdge };

/** 加载状态 */
type LoadState = "loading" | "success" | "error";

/** KnowledgeGraph 属性 */
interface KnowledgeGraphProps {
  /** 初始过滤参数（可选） */
  initialFilters?: GraphFilterState;
}

/**
 * 知识图谱主组件。
 */
export function KnowledgeGraph({ initialFilters }: KnowledgeGraphProps) {
  const [filters, setFilters] = useState<GraphFilterState>(
    initialFilters ?? DEFAULT_FILTERS
  );
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // React Flow 状态
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // React Flow 实例（用于缩放/重置）
  const reactFlow = useReactFlow();

  // d3-force 仿真器引用
  const simulationRef = useRef<Simulation<ForceNode, ForceLink> | null>(null);
  // 布局版本号（变化时触发重新布局）
  const [layoutVersion, setLayoutVersion] = useState(0);

  /** 获取图谱数据 */
  const fetchGraph = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg("");

    try {
      const params = new URLSearchParams();
      if (filters.sourceTypes.length > 0) {
        params.set("sourceTypes", filters.sourceTypes.join(","));
      }
      if (filters.entityTypes.length > 0) {
        params.set("entityTypes", filters.entityTypes.join(","));
      }
      if (filters.minWeight > 0) {
        params.set("minWeight", String(filters.minWeight));
      }
      if (filters.startDate) {
        params.set("startDate", filters.startDate);
      }
      if (filters.endDate) {
        params.set("endDate", filters.endDate);
      }

      const res = await fetch(`/api/graph?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "获取失败");
      }

      setData(json.data);
      setLoadState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "未知错误");
      setLoadState("error");
    }
  }, [filters]);

  /** filters 变化时重新获取 */
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  /** 计算度中心性（每个节点的关联数） */
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    for (const edge of data.edges) {
      map.set(edge.source, (map.get(edge.source) ?? 0) + 1);
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1);
    }
    return map;
  }, [data]);

  /** 数据变化时，转换为 ReactFlow 节点/边并运行 d3-force 布局 */
  useEffect(() => {
    if (!data || data.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 转换为 ReactFlow 节点
    const flowNodes: FlowNode[] = data.nodes.map((node) => ({
      id: node.id,
      type: "knowledge",
      position: { x: 0, y: 0 }, // 初始位置，d3-force 会更新
      data: {
        id: node.id,
        title: node.title,
        sourceType: node.sourceType,
        degree: degreeMap.get(node.id) ?? 0,
        createdAt: node.createdAt,
      },
    }));

    // 转换为 ReactFlow 边
    const flowEdges: FlowEdge[] = data.edges.map((edge, idx) => ({
      id: `e-${edge.source}-${edge.target}-${idx}`,
      source: edge.source,
      target: edge.target,
      type: "knowledge",
      data: {
        weight: edge.weight,
        sharedEntityNames: edge.sharedEntities.map((e) => e.name),
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);

    // 运行 d3-force 布局
    runForceLayout(flowNodes, flowEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layoutVersion]);

  /**
   * 运行 d3-force 力导向布局。
   *
   * @param flowNodes ReactFlow 节点
   * @param flowEdges ReactFlow 边
   */
  const runForceLayout = (flowNodes: FlowNode[], flowEdges: FlowEdge[]) => {
    // 停止旧的仿真
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // 准备 d3-force 节点（初始随机位置）
    const forceNodes: ForceNode[] = flowNodes.map((n) => ({
      id: n.id,
      data: n.data,
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
    }));

    // 准备 d3-force 边
    const forceLinks: ForceLink[] = flowEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.data?.weight ?? 0.5,
      sharedEntityNames: e.data?.sharedEntityNames ?? [],
    }));

    // 节点 ID → 索引映射（d3-force 需要）
    const nodeIndex = new Map(forceNodes.map((n, i) => [n.id, i]));

    // 创建仿真
    const simulation = forceSimulation<ForceNode>(forceNodes)
      .force(
        "charge",
        forceManyBody().strength(-300)
      )
      .force(
        "link",
        forceLink<ForceNode, ForceLink>()
          .id((d) => d.id)
          .links(forceLinks)
          .distance(80)
          .strength(0.1)
      )
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(0.05))
      .force("y", forceY(0).strength(0.05))
      .alphaDecay(0.05);

    simulationRef.current = simulation;

    // 每帧更新节点位置
    simulation.on("tick", () => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const forceNode = forceNodes.find((fn) => fn.id === node.id);
          if (!forceNode) return node;
          return {
            ...node,
            position: {
              x: forceNode.x ?? 0,
              y: forceNode.y ?? 0,
            },
          };
        })
      );
    });

    // 仿真结束后 fitView
    simulation.on("end", () => {
      setTimeout(() => reactFlow.fitView({ padding: 0.2 }), 50);
    });
  };

  /** 重新布局 */
  const handleRelayout = () => {
    if (data && data.nodes.length > 0) {
      setLayoutVersion((v) => v + 1);
    }
  };

  /** 节点点击 → 跳转知识详情 */
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    window.open(`/knowledge/${node.id}`, "_self");
  };

  /** 组件卸载时停止仿真 */
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  // 渲染
  if (loadState === "loading") {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="mb-3 h-8 w-8 animate-spin" />
        <p className="text-sm">加载图谱中...</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex h-full flex-col items-center justify-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <p className="mb-4 text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={fetchGraph}>
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadState === "success" && (!data || data.nodes.length === 0)) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex h-full flex-col items-center justify-center">
          <Network className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="mb-1 text-lg font-medium">暂无图谱数据</p>
          <p className="text-sm text-muted-foreground">
            蒸馏更多知识后，图谱将自动建立关联
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ccc" gap={16} />
      </ReactFlow>

      {/* 控制面板 + 过滤面板 */}
      <GraphControls
        filters={filters}
        onFiltersChange={setFilters}
        onZoomIn={() => reactFlow.zoomIn()}
        onZoomOut={() => reactFlow.zoomOut()}
        onFitView={() => reactFlow.fitView({ padding: 0.2 })}
        onRelayout={handleRelayout}
      />

      {/* 统计信息（左下角） */}
      {data && (
        <div className="absolute bottom-4 left-4 rounded-md border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          节点 {data.stats.filteredNodes}/{data.stats.totalNodes} ·
          关联 {data.stats.filteredEdges}/{data.stats.totalEdges}
          {data.stats.filteredNodes < data.stats.totalNodes && (
            <span className="ml-1 text-amber-600">
              （已按关联强度截断）
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。若 `useNodesState<FlowNode>` 泛型报错，确认 `@xyflow/react` v12 已安装且类型正确。

---

## Task 11: 图谱页面

**Files:**
- Modify: `apps/web/src/app/(dashboard)/graph/page.tsx`

- [ ] **Step 1: 替换占位页为图谱客户端组件**

Replace the entire content of `apps/web/src/app/(dashboard)/graph/page.tsx` with:

```typescript
/**
 * 知识图谱页。
 *
 * 展示用户知识库的力导向图谱，支持：
 * - 节点（知识）按来源类型显示几何图标
 * - 边（关联）按实体共现强度显示粗细
 * - 4 维过滤（来源类型、关联强度、实体类型、时间范围）
 * - 缩放、重置、重新布局
 * - 点击节点跳转知识详情
 */

"use client";

import { Network } from "lucide-react";
import { KnowledgeGraph } from "@/components/graph/KnowledgeGraph";

/**
 * 知识图谱页面。
 */
export default function GraphPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <Network className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">知识图谱</h1>
      </div>

      {/* 图谱说明 */}
      <p className="text-sm text-muted-foreground">
        图谱基于知识间的共享实体（人物、概念、组织等）自动建立关联。
        节点越大表示关联越多，边越粗表示关联越强。
      </p>

      {/* 图谱主组件 */}
      <KnowledgeGraph />
    </div>
  );
}
```

- [ ] **Step 2: 验证类型**

Run（在 `apps/web` 目录）:
```bash
pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 3: 手动测试**

1. 确保 Next.js dev server 运行中（`pnpm dev`）
2. 浏览器访问 `http://localhost:3000/graph`
3. 验证：
   - 页面加载，显示标题和说明
   - 图谱渲染（若知识库有数据）
   - 节点显示几何图标 + 标题
   - 边连接共享实体的节点
   - 过滤面板可展开/收起
   - 来源类型/实体类型过滤可切换
   - 关联强度滑块可拖动
   - 缩放/重置/重新布局按钮工作
   - 点击节点跳转知识详情页
   - 悬停边显示共享实体 tooltip

---

## Task 12: 端到端验证

- [ ] **Step 1: 验证关联自动创建**

1. 在首页蒸馏一条新知识（文本或 PDF）
2. 等待蒸馏完成
3. 检查 Next.js 控制台日志，应出现 `[Graph] 为知识 xxx 创建了 N 条关联`
4. 访问 `/graph` 页面，新知识应出现在图谱中

- [ ] **Step 2: 验证过滤功能**

1. 打开 `/graph` 页面
2. 只勾选 "PDF" 来源类型 → 图谱只显示 PDF 节点
3. 拖动关联强度滑块到 50% → 只显示 weight ≥ 0.5 的边
4. 选择实体类型 "人物" → 只显示含人物实体的节点
5. 设置时间范围 → 只显示该时间段的知识
6. 点击重置按钮 → 恢复全部

- [ ] **Step 3: 验证交互**

1. 点击节点 → 跳转到 `/knowledge/[id]`
2. 悬停节点 → 显示 tooltip（标题、来源、关联数、时间）
3. 悬停边 → 显示共享实体列表
4. 拖拽节点 → 位置移动
5. 滚轮 → 缩放画布
6. 右键拖拽 → 平移画布
7. 点击"重置视图" → fitView
8. 点击"重新布局" → 重新用力导向算法排列

- [ ] **Step 4: 更新任务清单**

在 `.trae/specs/ai-knowledge-distillation/tasks.md` 中，将 Phase 5 的 4 个任务标记为完成：

```markdown
- [x] Task 5.1: 实现图谱服务 ✅ 已完成
- [x] Task 5.2: 实现图谱 API ✅ 已完成
- [x] Task 5.3: 实现图谱可视化 ✅ 已完成
- [x] Task 5.4: 实现图谱过滤 ✅ 已完成
```

更新进度总览：
```markdown
| Phase 5：知识图谱 | ✅ 全部完成 | 4/4 |
```

---

## Self-Review

### 1. Spec 覆盖检查

| 设计文档章节 | 对应 Task | 状态 |
|-------------|-----------|------|
| §1 目标 | Task 10, 11（发现隐藏关联的可视化） | ✅ |
| §2 架构概览（三层） | Task 2-5（Service/API/UI） | ✅ |
| §3 关联算法（实体共现） | Task 2（calculateRelationWeight + createConnections） | ✅ |
| §3.5 边的方向（新知识为 source） | Task 2（upsert sourceId=newKnowledgeId） | ✅ |
| §4.1 GET /api/graph | Task 5 | ✅ |
| §4.1 过滤参数（6 个） | Task 5 + Task 9 | ✅ |
| §4.1 limit 截断（度中心性） | Task 3（getGraphData） | ✅ |
| §4.2 认证 | Task 5（auth()） | ✅ |
| §5.1 力导向布局 | Task 10（d3-force） | ✅ |
| §5.2 节点设计（几何图标） | Task 6 + Task 7 | ✅ |
| §5.3 边设计（粗细/透明度映射 weight） | Task 8 | ✅ |
| §5.4 交互（点击/悬停/拖拽/缩放） | Task 10 + Task 7/8 | ✅ |
| §5.5 控制面板 | Task 9 | ✅ |
| §5.6 过滤面板（4 维） | Task 9 | ✅ |
| §6 文件清单（8 新建 + 2 修改） | Task 1-11 | ✅ |
| §7 数据流（关联创建 + 图谱渲染） | Task 4 + Task 10 | ✅ |
| §8 错误处理（5 场景） | Task 2（createConnections catch）+ Task 10（空状态/错误态） | ✅ |
| §10 依赖 | Task 1 | ✅ |

**无遗漏。**

### 2. 占位符扫描

- 无 "TBD"、"TODO"、"implement later"
- 无 "add appropriate error handling"（所有错误处理都有具体代码）
- 无 "similar to Task N"（每个任务代码完整）
- 无未定义的类型/函数引用

### 3. 类型一致性

| 类型/函数 | 定义位置 | 使用位置 | 一致性 |
|-----------|----------|----------|--------|
| `GraphNode`（类型） | types.ts | graph.service.ts, KnowledgeGraph.tsx | ✅ |
| `GraphEdge`（类型） | types.ts | graph.service.ts, KnowledgeGraph.tsx | ✅ |
| `GraphResponse` | types.ts | api/graph/route.ts, KnowledgeGraph.tsx | ✅ |
| `GraphFilters` | types.ts | graph.service.ts, api/graph/route.ts | ✅ |
| `Entity` | types.ts | graph.service.ts | ✅ |
| `calculateRelationWeight` | graph.service.ts | graph.service.ts（内部） | ✅ |
| `createConnections` | graph.service.ts | distill.service.ts | ✅ |
| `getGraphData` | graph.service.ts | api/graph/route.ts | ✅ |
| `KnowledgeNodeData` | GraphNode.tsx | KnowledgeGraph.tsx | ✅ |
| `KnowledgeEdgeData` | GraphEdge.tsx | KnowledgeGraph.tsx | ✅ |
| `GraphFilterState` | GraphControls.tsx | KnowledgeGraph.tsx | ✅ |
| `SOURCE_VISUAL_CONFIG` | icons.tsx | GraphNode.tsx, GraphControls.tsx | ✅ |
| `sourceId_targetId` | Prisma 复合唯一约束 | graph.service.ts（upsert where） | ✅ |

**类型一致。**
