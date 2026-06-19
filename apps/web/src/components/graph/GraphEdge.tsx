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
