/**
 * 知识库列表页。
 *
 * 功能：
 * - 卡片/列表视图切换
 * - 标签过滤（多选）
 * - 来源类型过滤
 * - 排序（创建时间/更新时间/标题）
 * - 关键词搜索
 * - 分页
 * - 空状态/加载态/错误态
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Library,
  LayoutGrid,
  List,
  Search,
  AlertCircle,
  FileText,
  Inbox,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { KnowledgeCard, type KnowledgeItem } from "@/components/knowledge/knowledge-card";
import { TagFilter, type TagFilterItem } from "@/components/knowledge/tag-filter";
import { KnowledgeCardSkeletonGrid } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/** 视图模式 */
type ViewMode = "grid" | "list";

/** 排序选项 */
type SortBy = "createdAt" | "updatedAt" | "title";
type SortOrder = "asc" | "desc";

/** 来源类型选项 */
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "text", label: "文本" },
  { value: "markdown", label: "Markdown" },
  { value: "url", label: "网页" },
  { value: "pdf", label: "PDF" },
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
];

/** 排序选项配置 */
const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "createdAt", label: "创建时间" },
  { value: "updatedAt", label: "更新时间" },
  { value: "title", label: "标题" },
];

/** API 响应类型 */
interface KnowledgeListResponse {
  items: KnowledgeItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 加载状态 */
type LoadState = "loading" | "success" | "error";

/** 来源类型图标映射 */
const SOURCE_ICON: Record<string, typeof FileText> = {
  text: FileText,
  markdown: FileText,
  url: FileText,
  pdf: FileText,
  douyin: FileText,
  xiaohongshu: FileText,
};

/**
 * 知识库列表页主组件。
 *
 * 管理过滤条件、视图模式、分页状态，从 API 获取数据并渲染。
 */
export default function LibraryPage() {
  // 视图与排序状态
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 过滤状态
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<string[]>([]);

  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // 数据状态
  const [tags, setTags] = useState<TagFilterItem[]>([]);
  const [data, setData] = useState<KnowledgeListResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  /** 获取标签列表 */
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch("/api/tags");
        const json = await res.json();
        if (json.success) {
          setTags(json.data);
        }
      } catch {
        // 标签加载失败不阻塞主流程
      }
    };
    fetchTags();
  }, []);

  /** 获取知识列表 */
  const fetchKnowledge = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (searchQuery) params.set("q", searchQuery);
      if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));
      if (selectedSourceTypes.length > 0) params.set("sourceTypes", selectedSourceTypes.join(","));

      const res = await fetch(`/api/knowledge?${params.toString()}`);
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
  }, [page, pageSize, sortBy, sortOrder, searchQuery, selectedTagIds, selectedSourceTypes]);

  useEffect(() => {
    fetchKnowledge();
  }, [fetchKnowledge]);

  /** 搜索提交（重置到第一页） */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchKnowledge();
  };

  /** 标签变更（重置到第一页） */
  const handleTagChange = (tagIds: string[]) => {
    setSelectedTagIds(tagIds);
    setPage(1);
  };

  /** 来源类型切换（重置到第一页） */
  const toggleSourceType = (type: string) => {
    setSelectedSourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  };

  /** 排序变更（重置到第一页） */
  const handleSortChange = (newSortBy: SortBy) => {
    if (newSortBy === sortBy) {
      // 同一字段 → 切换排序方向
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc");
    }
    setPage(1);
  };

  /** 是否有过滤条件 */
  const hasFilters =
    searchQuery !== "" ||
    selectedTagIds.length > 0 ||
    selectedSourceTypes.length > 0;

  /** 清除所有过滤 */
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTagIds([]);
    setSelectedSourceTypes([]);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in-up">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">知识库</h1>
          {data && (
            <span className="text-sm text-muted-foreground">
              共 {data.total} 条
            </span>
          )}
        </div>
        {/* 视图切换 */}
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-7"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid className="h-4 w-4" />
            卡片
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-7"
            aria-pressed={viewMode === "list"}
          >
            <List className="h-4 w-4" />
            列表
          </Button>
        </div>
      </div>

      {/* 搜索栏 + 排序 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜索标题或内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>
        {/* 排序按钮组 */}
        <div className="flex flex-wrap items-center gap-1">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={sortBy === option.value ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleSortChange(option.value)}
              className="h-9"
            >
              {option.label}
              {sortBy === option.value && (
                <span className="ml-0.5 text-xs">
                  {sortOrder === "asc" ? "↑" : "↓"}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* 过滤器区域 */}
      <div className="space-y-3">
        {/* 来源类型过滤 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted-foreground mr-1">来源：</span>
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSourceType(option.value)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs transition-colors",
                selectedSourceTypes.includes(option.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {/* 标签过滤 */}
        <TagFilter
          tags={tags}
          selectedTagIds={selectedTagIds}
          onChange={handleTagChange}
        />
        {/* 清除过滤 */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3" />
            清除所有过滤
          </Button>
        )}
      </div>

      {/* 内容区域 */}
      {loadState === "loading" && (
        <KnowledgeCardSkeletonGrid count={pageSize} />
      )}

      {loadState === "error" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground mb-4" role="alert">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={fetchKnowledge}>
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {loadState === "success" && data && data.items.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={hasFilters ? "未找到匹配的知识" : "知识库还是空的"}
          description={
            hasFilters
              ? "试试调整过滤条件或清除筛选"
              : "去首页蒸馏你的第一条知识吧"
          }
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                清除筛选
              </Button>
            ) : undefined
          }
        />
      )}

      {loadState === "success" && data && data.items.length > 0 && (
        <>
          {/* 卡片视图 */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((item) => (
                <KnowledgeCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            /* 列表视图 */
            <div className="space-y-2">
              {data.items.map((item) => (
                <KnowledgeListRow key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 知识列表行组件（列表视图）。
 *
 * 紧凑的横向布局，适合信息密度较高的浏览场景。
 */
function KnowledgeListRow({ item }: { item: KnowledgeItem }) {
  const summary =
    (item.distilledData?.summary as string) ?? "";
  const SourceIcon = SOURCE_ICON[item.sourceType] ?? FileText;

  return (
    <a
      href={`/knowledge/${item.id}`}
      className="block group"
    >
      <Card className="transition-colors hover:bg-accent/30">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="mt-0.5 shrink-0">
            <SourceIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              {item.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
            {summary && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {summary}
              </p>
            )}
          </div>
          <div className="shrink-0 text-xs text-muted-foreground/70">
            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
