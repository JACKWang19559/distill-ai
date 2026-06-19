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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn} title="放大" aria-label="放大">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut} title="缩小" aria-label="缩小">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitView} title="重置视图" aria-label="重置视图">
          <Maximize className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRelayout} title="重新布局" aria-label="重新布局">
          <Shuffle className="h-4 w-4" />
        </Button>
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowFilters(!showFilters)}
          title="过滤面板"
          aria-label="过滤面板"
          aria-pressed={showFilters}
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
                  aria-label="重置过滤"
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
                aria-label="收起过滤面板"
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
