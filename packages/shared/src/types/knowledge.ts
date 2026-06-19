/**
 * 知识条目相关类型定义。
 *
 * 对应 Prisma Schema 中的 Knowledge 模型。
 */

/** 知识来源类型 */
export type SourceType =
  | "text"        // 纯文本
  | "markdown"    // Markdown 文本
  | "url"         // 网页链接
  | "pdf"         // PDF 文件
  | "douyin"      // 抖音视频
  | "xiaohongshu"; // 小红书笔记

/** 蒸馏状态 */
export type DistillStatus =
  | "pending"     // 等待处理
  | "processing"  // 处理中
  | "completed"   // 已完成
  | "failed";     // 失败

/** 媒体元数据（视频/音频蒸馏时附加） */
export interface MediaMeta {
  /** 平台 */
  platform: "douyin" | "xiaohongshu";
  /** 作者 */
  author?: string;
  /** 视频时长（秒） */
  duration?: number;
  /** 视频标题 */
  videoTitle?: string;
  /** 笔记类型（小红书） */
  noteType?: "image" | "video";
  /** 标签列表 */
  tags?: string[];
  /** IP 归属地 */
  ipLocation?: string;
  /** 点赞数 */
  likedCount?: string;
  /** 收藏数 */
  collectedCount?: string;
  /** 评论数 */
  commentCount?: string;
}

/** 实体类型 */
export type EntityType =
  | "person"        // 人物
  | "concept"       // 概念
  | "organization"  // 组织
  | "technology"    // 技术
  | "location"      // 地点
  | "event";        // 事件

/** 提取的实体（用于知识图谱构建） */
export interface Entity {
  /** 实体名称 */
  name: string;
  /** 实体类型 */
  type: EntityType;
}

/** 蒸馏结果结构 */
export interface DistillResult {
  /** 摘要（200 字以内） */
  summary: string;
  /** 关键点列表（3-7 个，每个不超过 50 字） */
  keyPoints: string[];
  /** 大纲（Markdown 格式） */
  outline: string;
  /** 推荐标签（3-5 个） */
  suggestedTags: string[];
  /** 提取的实体列表（用于知识图谱） */
  entities?: Entity[];
}

/** 知识条目 */
export interface Knowledge {
  id: string;
  /** 用户 ID */
  userId: string;
  /** 标题 */
  title: string;
  /** 来源类型 */
  sourceType: SourceType;
  /** 来源 URL */
  sourceUrl?: string | null;
  /** 原始内容 */
  rawContent: string;
  /** 蒸馏结果（JSON） */
  distilledData: DistillResult;
  /** 蒸馏状态 */
  status: DistillStatus;
  /** 错误信息 */
  errorMessage?: string | null;
  /** 媒体元数据（JSON） */
  mediaMeta?: MediaMeta | null;
  /** 用户笔记 */
  userNote?: string | null;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 软删除时间 */
  deletedAt?: Date | null;
  /** 关联标签 */
  tags?: Tag[];
}

/** 标签 */
export interface Tag {
  id: string;
  /** 用户 ID */
  userId: string;
  /** 标签名 */
  name: string;
  /** 颜色（十六进制） */
  color?: string | null;
  /** 创建时间 */
  createdAt: Date;
}

/** 知识关联 */
export interface KnowledgeConnection {
  id: string;
  /** 源知识 ID */
  sourceId: string;
  /** 目标知识 ID */
  targetId: string;
  /** 关联强度（0-1） */
  weight: number;
  /** 关联原因 */
  reason?: string | null;
  /** 创建时间 */
  createdAt: Date;
}

/** 知识图谱节点 */
export interface GraphNode {
  id: string;
  /** 节点标题 */
  title: string;
  /** 来源类型 */
  sourceType: SourceType;
  /** 标签列表 */
  tags?: string[];
  /** 创建时间 */
  createdAt: Date;
}

/** 知识图谱边 */
export interface GraphEdge {
  id: string;
  /** 源节点 ID */
  source: string;
  /** 目标节点 ID */
  target: string;
  /** 关联强度 */
  weight: number;
}

/** 知识图谱数据 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
