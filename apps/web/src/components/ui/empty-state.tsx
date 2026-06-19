"use client";

/**
 * EmptyState 空状态组件。
 *
 * 统一所有列表页的空状态展示，包含图标、标题、描述和可选操作按钮。
 * 遵循 shadcn/ui new-york 风格。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/** EmptyState 组件属性 */
interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 图标元素（lucide-react 图标组件） */
  icon?: React.ElementType;
  /** 标题 */
  title: string;
  /** 描述文本 */
  description?: string;
  /** 操作按钮（通常是一个或多个 Button） */
  action?: React.ReactNode;
}

/**
 * EmptyState 空状态组件。
 *
 * 用于列表页、搜索结果页等无数据时的占位展示。
 *
 * @param icon - 图标组件
 * @param title - 标题文本
 * @param description - 描述文本
 * @param action - 可选操作按钮
 * @param className - 额外类名
 * @returns EmptyState 组件
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
