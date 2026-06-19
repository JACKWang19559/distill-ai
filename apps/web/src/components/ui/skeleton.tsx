import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton 骨架屏基础组件。
 *
 * 使用 Tailwind animate-pulse 实现占位动画效果，
 * 参考 shadcn/ui new-york 风格。
 */
const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

/**
 * 知识卡片骨架屏。
 *
 * 模拟 KnowledgeCard 的形状：来源行 + 标题行 + 摘要行 + 标签行 + 时间行。
 */
function KnowledgeCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow p-6 space-y-3">
      {/* 来源 + 状态行 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      {/* 标题行 */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      {/* 摘要行 */}
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      {/* 标签行 */}
      <div className="flex gap-1 pt-1">
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-10 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      {/* 时间行 */}
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/**
 * 知识卡片骨架屏网格。
 *
 * 根据传入数量渲染对应数量的卡片骨架，默认 12 个。
 */
function KnowledgeCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KnowledgeCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 搜索结果骨架屏。
 *
 * 模拟搜索结果卡片的形状：标题行 + 内容行 + 标签行。
 */
function SearchResultSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow p-4 space-y-2">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      {/* 内容行 */}
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      {/* 标签 + 时间行 */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-1">
          <Skeleton className="h-4 w-10 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * 搜索结果骨架屏列表。
 *
 * 根据传入数量渲染对应数量的搜索结果骨架，默认 6 个。
 */
function SearchResultSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SearchResultSkeleton key={i} />
      ))}
    </div>
  );
}

export {
  Skeleton,
  KnowledgeCardSkeleton,
  KnowledgeCardSkeletonGrid,
  SearchResultSkeleton,
  SearchResultSkeletonList,
};
