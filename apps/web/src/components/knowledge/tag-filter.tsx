/**
 * TagFilter 组件 - 标签过滤器。
 *
 * 展示用户所有标签，支持多选切换：
 * - 横向滚动排列标签药丸
 * - 点击切换选中状态
 * - 显示每个标签关联的知识数量
 * - 支持清除所有选中
 */

"use client";

import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 标签项（含关联知识数） */
export interface TagFilterItem {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

/** TagFilter 属性 */
interface TagFilterProps {
  /** 标签列表 */
  tags: TagFilterItem[];
  /** 当前选中的标签 ID 列表 */
  selectedTagIds: string[];
  /** 选中状态变更回调 */
  onChange: (tagIds: string[]) => void;
}

/**
 * 标签过滤器组件。
 *
 * 以药丸形式展示所有标签，支持多选切换。
 * 选中的标签会高亮显示，点击已选中的标签可取消选中。
 */
export function TagFilter({ tags, selectedTagIds, onChange }: TagFilterProps) {
  /** 切换标签选中状态 */
  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  /** 清除所有选中 */
  const clearAll = () => {
    onChange([]);
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Tag className="h-4 w-4" />
          标签筛选
        </div>
        {selectedTagIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3 w-3" />
            清除
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
              style={
                !isSelected && tag.color
                  ? { borderColor: `${tag.color}40`, color: tag.color }
                  : undefined
              }
            >
              {tag.name}
              <span
                className={cn(
                  "rounded px-1 text-[10px]",
                  isSelected
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tag.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
