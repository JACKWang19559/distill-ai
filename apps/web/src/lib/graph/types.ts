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
