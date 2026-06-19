/**
 * 搜索页。
 *
 * 功能：
 * - 关键词全文搜索（ILIKE）
 * - 来源类型过滤（药丸按钮多选）
 * - 标签过滤（复用 TagFilter 组件）
 * - 搜索结果关键词高亮（<mark> 标签）
 * - 分页（上一页/下一页 + 页码）
 * - 初始/加载/错误/空状态处理
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  AlertCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  FileCode,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  TagFilter,
  type TagFilterItem,
} from "@/components/knowledge/tag-filter";
import { SearchResultSkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/** 来源类型选项（用于过滤药丸） */
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "text", label: "文本" },
  { value: "markdown", label: "Markdown" },
  { value: "url", label: "网页" },
  { value: "pdf", label: "PDF" },
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
];

/** 来源类型图标 + 颜色配置（用于结果徽章） */
const SOURCE_CONFIG: Record<
  string,
  { icon: typeof FileText; label: string; color: string }
> = {
  text: { icon: FileText, label: "文本", color: "text-blue-500" },
  markdown: { icon: FileCode, label: "Markdown", color: "text-purple-500" },
  url: { icon: LinkIcon, label: "网页", color: "text-green-500" },
  pdf: { icon: FileText, label: "PDF", color: "text-red-500" },
  douyin: { icon: Video, label: "抖音", color: "text-pink-500" },
  xiaohongshu: { icon: ImageIcon, label: "小红书", color: "text-rose-500" },
};

/** 标签类型 */
interface Tag {
  id: string;
  name: string;
  color: string | null;
}

/** 搜索结果项（与 API 响应对应） */
interface SearchItem {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  distilledData: Record<string, unknown>;
  mediaMeta: unknown;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  /** 匹配片段（前后可能有 ... 省略号） */
  snippet: string;
}

/** 搜索 API 响应数据 */
interface SearchData {
  items: SearchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
}

/** 加载状态 */
type LoadState = "idle" | "loading" | "success" | "error";

/**
 * 转义 HTML 特殊字符，防止 XSS。
 *
 * @param text - 原始文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 转义正则表达式特殊字符。
 *
 * @param s - 原始字符串
 * @returns 转义后的字符串
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 高亮搜索关键词。
 *
 * 将 query 按空格拆分为多个关键词，对 snippet 做不区分大小写的替换，
 * 用 <mark> 标签包裹匹配的关键词。
 *
 * 处理流程：
 * 1. 先转义整个 snippet 文本（防止 XSS）
 * 2. 拆分 query 为多个关键词，并各自转义
 * 3. 构造联合正则，不区分大小写匹配任一关键词
 * 4. 用 <mark> 标签替换匹配项
 *
 * @param text - 原始片段文本
 * @param query - 搜索关键词（可能包含多个以空格分隔的词）
 * @returns 包含 <mark> 标签的 HTML 字符串
 */
function highlightSnippet(text: string, query: string): string {
  // 先转义整个文本，防止 XSS
  const escaped = escapeHtml(text);

  // 拆分关键词，过滤空字符串，并转义每个关键词
  const keywords = query
    .trim()
    .split(/\s+/)
    .filter((k) => k.length > 0)
    .map((k) => escapeHtml(k));

  // 无关键词则直接返回转义后的文本
  if (keywords.length === 0) {
    return escaped;
  }

  // 构造正则：不区分大小写匹配任一关键词
  const pattern = new RegExp(
    `(${keywords.map(escapeRegExp).join("|")})`,
    "gi"
  );

  // 替换为 <mark> 标签
  return escaped.replace(
    pattern,
    '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>'
  );
}

/**
 * 格式化日期为简短中文格式。
 *
 * @param date - ISO 日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 搜索页主组件。
 *
 * 管理搜索词、过滤条件、分页状态，从 /api/search 获取数据并渲染。
 */
export default function SearchPage() {
  // 输入框值（未提交的搜索词）
  const [inputValue, setInputValue] = useState("");
  // 已提交的搜索词（实际用于查询）
  const [submittedQuery, setSubmittedQuery] = useState("");

  // 过滤状态
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<string[]>([]);

  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // 数据状态
  const [tags, setTags] = useState<TagFilterItem[]>([]);
  const [data, setData] = useState<SearchData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  /** 获取标签列表（页面加载时执行一次） */
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

  /** 执行搜索请求 */
  const doSearch = useCallback(async () => {
    // q 参数必填，空字符串会返回 400
    if (!submittedQuery.trim()) {
      return;
    }

    setLoadState("loading");
    setErrorMsg("");

    try {
      const params = new URLSearchParams();
      params.set("q", submittedQuery);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (selectedTagIds.length > 0) {
        params.set("tagIds", selectedTagIds.join(","));
      }
      if (selectedSourceTypes.length > 0) {
        params.set("sourceTypes", selectedSourceTypes.join(","));
      }

      const res = await fetch(`/api/search?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "搜索失败");
      }

      setData(json.data);
      setLoadState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "未知错误");
      setLoadState("error");
    }
  }, [
    submittedQuery,
    page,
    pageSize,
    selectedTagIds,
    selectedSourceTypes,
  ]);

  /** 当搜索词或过滤条件变化时触发搜索 */
  useEffect(() => {
    if (submittedQuery.trim()) {
      doSearch();
    } else {
      setData(null);
      setLoadState("idle");
    }
  }, [doSearch, submittedQuery]);

  /** 搜索提交（重置到第一页） */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    setSubmittedQuery(trimmed);
    setPage(1);
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

  /** 清除所有过滤条件 */
  const clearFilters = () => {
    setSelectedTagIds([]);
    setSelectedSourceTypes([]);
    setPage(1);
  };

  /** 是否有过滤条件 */
  const hasFilters =
    selectedTagIds.length > 0 || selectedSourceTypes.length > 0;

  /** 跳转到指定页（并滚动到顶部） */
  const goToPage = (p: number) => {
    setPage(p);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /** 计算分页页码（显示当前页前后各 2 页） */
  const pageNumbers = useMemo(() => {
    if (!data) return [];
    const total = data.totalPages;
    const current = page;
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [data, page]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in-up">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">搜索</h1>
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="输入关键词搜索知识库..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-12 pl-11 text-base"
          />
        </div>
        <Button type="submit" size="lg" disabled={!inputValue.trim()}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
      </form>

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
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3" />
            清除过滤
          </Button>
        )}
      </div>

      {/* 内容区域 */}

      {/* 初始状态（未搜索） */}
      {loadState === "idle" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-1">输入关键词开始搜索</p>
            <p className="text-sm text-muted-foreground">
              搜索你的知识库，支持标题和内容匹配
            </p>
          </CardContent>
        </Card>
      )}

      {/* 搜索中 */}
      {loadState === "loading" && (
        <SearchResultSkeletonList count={6} />
      )}

      {/* 搜索错误 */}
      {loadState === "error" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground mb-4" role="alert">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={doSearch}>
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 无结果 */}
      {loadState === "success" && data && data.items.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="未找到匹配的知识"
          description="试试调整搜索词或过滤条件"
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                清除过滤
              </Button>
            ) : undefined
          }
        />
      )}

      {/* 有结果 */}
      {loadState === "success" && data && data.items.length > 0 && (
        <>
          {/* 结果统计 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              找到 <span className="font-medium text-foreground">{data.total}</span> 条结果
              {data.query && (
                <>
                  {" "}包含 <span className="font-medium text-foreground">"{data.query}"</span>
                </>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              第 {page} / {data.totalPages} 页
            </p>
          </div>

          {/* 结果列表（垂直排列） */}
          <div className="space-y-3">
            {data.items.map((item) => (
              <SearchResultCard
                key={item.id}
                item={item}
                query={submittedQuery}
              />
            ))}
          </div>

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              {pageNumbers.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(p)}
                  className="min-w-9"
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => goToPage(page + 1)}
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
 * 搜索结果卡片组件。
 *
 * 展示单条搜索结果，包含标题、来源类型徽章、匹配片段（关键词高亮）、标签、时间。
 *
 * @param item - 搜索结果项
 * @param query - 搜索关键词（用于高亮）
 */
function SearchResultCard({
  item,
  query,
}: {
  item: SearchItem;
  query: string;
}) {
  const sourceConfig = SOURCE_CONFIG[item.sourceType] ?? SOURCE_CONFIG.text;
  const SourceIcon = sourceConfig.icon;

  // 高亮后的 snippet HTML
  const snippetHtml = highlightSnippet(item.snippet, query);

  return (
    <Card className="transition-all hover:shadow-md hover:border-primary/30">
      <CardContent className="p-4 space-y-2">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/knowledge/${item.id}`}
            className="font-semibold leading-snug hover:text-primary transition-colors line-clamp-2"
          >
            {item.title}
          </Link>
          {/* 来源类型徽章 */}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
            <SourceIcon className={`h-3 w-3 ${sourceConfig.color}`} />
            {sourceConfig.label}
          </span>
        </div>

        {/* 匹配片段（关键词高亮） */}
        {item.snippet && (
          <p
            className="text-sm text-muted-foreground line-clamp-3"
            dangerouslySetInnerHTML={{ __html: snippetHtml }}
          />
        )}

        {/* 标签 + 时间 */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                  style={
                    tag.color
                      ? { backgroundColor: `${tag.color}20`, color: tag.color }
                      : undefined
                  }
                >
                  {tag.name}
                </span>
              ))}
              {item.tags.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{item.tags.length - 4}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground/70 shrink-0">
            <Clock className="h-3 w-3" />
            {formatDate(item.createdAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
