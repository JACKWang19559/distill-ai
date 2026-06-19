/**
 * 知识图谱页。
 *
 * 展示用户知识库的力导向图谱，支持：
 * - 节点（知识）按来源类型显示几何图标
 * - 边（关联）按实体共现强度显示粗细
 * - 4 维过滤（来源类型、关联强度、实体类型、时间范围）
 * - 缩放、重置、重新布局
 * - 点击节点跳转知识详情
 *
 * 性能优化：使用 next/dynamic 动态导入 KnowledgeGraph 组件，
 * 将 @xyflow/react + d3-force 重依赖从主 bundle 中分离，
 * 仅在访问图谱页时按需加载。
 */

"use client";

import { Network, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

/** 动态导入图谱组件（ssr: false，避免服务端加载重依赖） */
const KnowledgeGraph = dynamic(
  () => import("@/components/graph/KnowledgeGraph").then((m) => m.KnowledgeGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center rounded-xl border bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

/**
 * 知识图谱页面。
 */
export default function GraphPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 animate-fade-in-up">
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
