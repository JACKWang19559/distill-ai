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
import {
  Handle,
  Position,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { SOURCE_VISUAL_CONFIG } from "@/lib/graph/icons";

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

/** React Flow 节点类型（数据为 KnowledgeNodeData，类型为 "knowledge"） */
export type KnowledgeFlowNode = Node<KnowledgeNodeData, "knowledge">;

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
function GraphNodeComponent({ data }: NodeProps<KnowledgeFlowNode>) {
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
