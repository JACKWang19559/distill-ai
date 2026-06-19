/**
 * 知识详情页。
 *
 * 功能：
 * - 展示蒸馏结果（摘要、关键点、大纲、标签、实体）
 * - 展示原文（可折叠/展开，默认前 500 字）
 * - 展示用户笔记（可编辑）
 * - 编辑模式（标题、笔记、标签）
 * - 删除知识（确认后软删除并跳转回知识库）
 * - 关联知识推荐（横向卡片列表）
 * - 媒体元数据展示（作者、时长、平台等）
 * - 加载态 / 错误态 / 404 处理
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  FileCode,
  Clock,
  CheckCircle2,
  Hourglass,
  Plus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  StickyNote,
  Network,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 实体（蒸馏结果中提取的命名实体） */
interface Entity {
  name: string;
  type: string;
}

/** 标签项 */
interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

/** 标签过滤项（含关联知识数，来自 /api/tags） */
interface TagFilterItem {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

/** 关联知识项 */
interface RelatedItem {
  id: string;
  title: string;
  weight: number;
  reason: string | null;
}

/** 知识详情 */
interface KnowledgeDetail {
  id: string;
  userId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  rawContent: string;
  distilledData: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  mediaMeta: unknown;
  userNote: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagItem[];
  related: RelatedItem[];
}

/** API 响应 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** 来源类型配置：图标 + 标签 + 颜色 */
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

/** 蒸馏状态配置：图标 + 标签 + 颜色 + 背景 */
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; label: string; color: string; bg: string }
> = {
  completed: {
    icon: CheckCircle2,
    label: "已完成",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  processing: {
    icon: Loader2,
    label: "处理中",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  pending: {
    icon: Hourglass,
    label: "等待中",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  failed: {
    icon: AlertCircle,
    label: "失败",
    color: "text-red-600",
    bg: "bg-red-50",
  },
};

/** 加载状态 */
type LoadState = "loading" | "success" | "error" | "notfound";

/** 原文折叠时显示的字数 */
const RAW_PREVIEW_LENGTH = 500;

/** 格式化日期为中文长格式（含时分） */
function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 从 distilledData 安全提取字符串字段 */
function getString(
  distilledData: Record<string, unknown>,
  key: string
): string {
  const value = distilledData?.[key];
  return typeof value === "string" ? value : "";
}

/** 从 distilledData 安全提取字符串数组字段 */
function getStringArray(
  distilledData: Record<string, unknown>,
  key: string
): string[] {
  const value = distilledData?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** 从 distilledData 安全提取实体数组 */
function getEntities(distilledData: Record<string, unknown>): Entity[] {
  const value = distilledData?.entities;
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "",
      type: typeof item.type === "string" ? item.type : "",
    }))
    .filter((e) => e.name);
}

/** 媒体元数据可展示字段 */
interface MediaMetaFields {
  author?: string;
  duration?: string | number;
  platform?: string;
  likes?: number;
  views?: number;
  shares?: number;
  description?: string;
}

/** 从 mediaMeta（unknown）安全提取可展示字段 */
function getMediaMeta(mediaMeta: unknown): MediaMetaFields | null {
  if (typeof mediaMeta !== "object" || mediaMeta === null) return null;
  const obj = mediaMeta as Record<string, unknown>;
  const fields: MediaMetaFields = {};
  if (typeof obj.author === "string") fields.author = obj.author;
  if (typeof obj.duration === "string" || typeof obj.duration === "number")
    fields.duration = obj.duration;
  if (typeof obj.platform === "string") fields.platform = obj.platform;
  if (typeof obj.likes === "number") fields.likes = obj.likes;
  if (typeof obj.views === "number") fields.views = obj.views;
  if (typeof obj.shares === "number") fields.shares = obj.shares;
  if (typeof obj.description === "string") fields.description = obj.description;
  // 至少有一个字段才返回
  if (Object.keys(fields).length === 0) return null;
  return fields;
}

/** 格式化数字（如 1.2万） */
function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * 知识详情页主组件。
 *
 * 管理知识详情的获取、编辑、删除，以及原文展开/折叠等交互状态。
 */
export default function KnowledgeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";
  const { toast } = useToast();

  // 数据状态
  const [data, setData] = useState<KnowledgeDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<TagFilterItem[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 原文展开状态
  const [rawExpanded, setRawExpanded] = useState(false);

  /** 获取知识详情 */
  const fetchDetail = useCallback(async () => {
    setLoadState("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/knowledge/${id}`);
      const json: ApiResponse<KnowledgeDetail> = await res.json();
      if (!json.success || !json.data) {
        if (res.status === 404) {
          setLoadState("notfound");
          return;
        }
        throw new Error(json.error?.message ?? "获取失败");
      }
      setData(json.data);
      setLoadState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "未知错误");
      setLoadState("error");
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id, fetchDetail]);

  /** 获取标签列表（编辑模式时加载） */
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const json: ApiResponse<TagFilterItem[]> = await res.json();
      if (json.success && json.data) {
        setAvailableTags(json.data);
      }
    } catch {
      // 标签加载失败不阻塞编辑流程
    }
  }, []);

  /** 进入编辑模式，初始化编辑字段 */
  const handleStartEdit = () => {
    if (!data) return;
    setEditTitle(data.title);
    setEditNote(data.userNote ?? "");
    setEditTagIds(data.tags.map((t) => t.id));
    setIsEditing(true);
    fetchTags();
  };

  /** 取消编辑，重置编辑字段 */
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
    setEditNote("");
    setEditTagIds([]);
    setNewTagName("");
  };

  /** 切换标签选中状态 */
  const toggleTag = (tagId: string) => {
    setEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  /** 创建新标签并自动选中 */
  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json: ApiResponse<TagItem> = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? "创建标签失败");
      }
      const newTag = json.data;
      setAvailableTags((prev) => [
        ...prev,
        { id: newTag.id, name: newTag.name, color: newTag.color, count: 0 },
      ]);
      setEditTagIds((prev) => [...prev, newTag.id]);
      setNewTagName("");
    } catch (err) {
      toast({
        title: "创建标签失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "error",
      });
    } finally {
      setCreatingTag(false);
    }
  };

  /** 保存编辑（标题、笔记、标签） */
  const handleSave = async () => {
    if (!data) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;
    setSaving(true);
    try {
      const body: {
        title: string;
        userNote: string | null;
        tagIds: string[];
      } = {
        title: trimmedTitle,
        userNote: editNote.trim() || null,
        tagIds: editTagIds,
      };
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: ApiResponse<KnowledgeDetail> = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? "保存失败");
      }
      // PATCH 响应不含 related，合并原有 related
      setData((prev) =>
        prev ? { ...json.data!, related: prev.related } : prev
      );
      setIsEditing(false);
      toast({
        title: "保存成功",
        description: "知识详情已更新",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  /** 删除知识（确认后软删除并跳转） */
  const handleDelete = async () => {
    if (!data) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      const json: ApiResponse<null> = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "删除失败");
      }
      toast({
        title: "删除成功",
        description: "知识已移至回收站",
        variant: "success",
      });
      router.push("/library");
    } catch (err) {
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "error",
      });
      setDeleting(false);
    }
  };

  // ===== 渲染：加载态（骨架屏） =====
  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* 头部骨架 */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        {/* 主内容区骨架 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：蒸馏结果 */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
          {/* 右侧：元数据 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-20" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ===== 渲染：错误态 =====
  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground mb-4" role="alert">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={fetchDetail}>
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== 渲染：404 / 数据不存在 =====
  if (loadState === "notfound" || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-1">知识不存在</p>
            <p className="text-sm text-muted-foreground mb-4">
              该知识可能已被删除或链接有误
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/library">
                <ArrowLeft className="h-4 w-4" />
                返回知识库
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== 数据提取 =====
  const sourceConfig = SOURCE_CONFIG[data.sourceType] ?? SOURCE_CONFIG.text;
  const statusConfig = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.pending;
  const SourceIcon = sourceConfig.icon;
  const StatusIcon = statusConfig.icon;

  const summary = getString(data.distilledData, "summary");
  const keyPoints = getStringArray(data.distilledData, "keyPoints");
  const outline = getString(data.distilledData, "outline");
  const suggestedTags = getStringArray(data.distilledData, "suggestedTags");
  const entities = getEntities(data.distilledData);
  const mediaMeta = getMediaMeta(data.mediaMeta);

  const rawContent = data.rawContent ?? "";
  const rawPreview = rawContent.slice(0, RAW_PREVIEW_LENGTH);
  const rawCanExpand = rawContent.length > RAW_PREVIEW_LENGTH;

  // ===== 渲染：成功 =====
  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in-up">
      {/* 顶部导航：返回 + 操作按钮 */}
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/library">
            <ArrowLeft className="h-4 w-4" />
            返回知识库
          </Link>
        </Button>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  aria-label="删除知识"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除「{data?.title}」吗？此操作不可撤销，知识将被移至回收站。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        删除中...
                      </>
                    ) : (
                      "确认删除"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* 主内容区：左右布局（大屏）/ 上下布局（小屏） */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：蒸馏结果（占 2 列） */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              {/* 来源类型 + 状态 + 创建时间 + 来源链接 */}
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    sourceConfig.color
                  )}
                >
                  <SourceIcon className="h-3.5 w-3.5" />
                  {sourceConfig.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                    statusConfig.bg,
                    statusConfig.color
                  )}
                >
                  <StatusIcon
                    className={cn(
                      "h-3.5 w-3.5",
                      data.status === "processing" && "animate-spin"
                    )}
                  />
                  {statusConfig.label}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(data.createdAt)}
                </span>
                {data.sourceUrl && (
                  <a
                    href={data.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    来源链接
                  </a>
                )}
              </div>
              {/* 标题（编辑/展示切换） */}
              {isEditing ? (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title">标题</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>
              ) : (
                <h1 className="text-2xl font-bold leading-tight">
                  {data.title}
                </h1>
              )}
              {/* 失败时展示错误信息 */}
              {data.status === "failed" && data.errorMessage && (
                <p className="text-sm text-destructive mt-2">
                  {data.errorMessage}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 摘要 */}
              {summary && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                    摘要
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {summary}
                  </p>
                </section>
              )}

              {/* 关键点（有序列表） */}
              {keyPoints.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                    关键点
                  </h2>
                  <ol className="space-y-2">
                    {keyPoints.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex gap-2 text-sm leading-relaxed"
                      >
                        <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {idx + 1}
                        </span>
                        <span className="pt-0.5">{point}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* 大纲（markdown 原文展示） */}
              {outline && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                    大纲
                  </h2>
                  <pre className="rounded-md bg-muted/50 p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                    {outline}
                  </pre>
                </section>
              )}

              {/* 实体 */}
              {entities.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                    实体
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {entities.map((entity, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-xs"
                      >
                        <span className="text-muted-foreground mr-1">
                          {entity.type}
                        </span>
                        {entity.name}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 标签 */}
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                  标签
                </h2>
                {isEditing ? (
                  <TagEditor
                    availableTags={availableTags}
                    selectedTagIds={editTagIds}
                    newTagName={newTagName}
                    creatingTag={creatingTag}
                    onToggleTag={toggleTag}
                    onNewTagNameChange={setNewTagName}
                    onCreateTag={handleCreateTag}
                  />
                ) : data.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.tags.map((tag) => (
                      <TagPill key={tag.id} tag={tag} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    暂无标签
                  </p>
                )}
                {/* 建议标签（仅展示模式） */}
                {!isEditing && suggestedTags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground/70 mb-1">
                      建议标签：
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md border border-dashed bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：媒体元数据 + 原文 + 笔记（占 1 列） */}
        <div className="space-y-6">
          {/* 媒体元数据 */}
          {mediaMeta && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">媒体信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {mediaMeta.author && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">作者</span>
                    <span className="font-medium">{mediaMeta.author}</span>
                  </div>
                )}
                {mediaMeta.platform && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平台</span>
                    <span className="font-medium">{mediaMeta.platform}</span>
                  </div>
                )}
                {mediaMeta.duration !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">时长</span>
                    <span className="font-medium">
                      {String(mediaMeta.duration)}
                    </span>
                  </div>
                )}
                {typeof mediaMeta.likes === "number" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">点赞</span>
                    <span className="font-medium">
                      {formatNumber(mediaMeta.likes)}
                    </span>
                  </div>
                )}
                {typeof mediaMeta.views === "number" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">播放</span>
                    <span className="font-medium">
                      {formatNumber(mediaMeta.views)}
                    </span>
                  </div>
                )}
                {typeof mediaMeta.shares === "number" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">分享</span>
                    <span className="font-medium">
                      {formatNumber(mediaMeta.shares)}
                    </span>
                  </div>
                )}
                {mediaMeta.description && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-xs">简介</span>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {mediaMeta.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 原文（可折叠/展开） */}
          {rawContent && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  原文
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                  {rawExpanded ? rawContent : rawPreview}
                  {!rawExpanded && rawCanExpand && (
                    <span className="text-muted-foreground/50">...</span>
                  )}
                </div>
                {rawCanExpand && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRawExpanded((v) => !v)}
                    className="mt-3 h-7 text-xs"
                  >
                    {rawExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        展开全文（共 {rawContent.length} 字）
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* 用户笔记 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                笔记
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="添加你的笔记..."
                  rows={6}
                  maxLength={5000}
                />
              ) : data.userNote ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {data.userNote}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">
                  暂无笔记
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 编辑模式：保存/取消操作栏（浮动固定） */}
      {isEditing && (
        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !editTitle.trim()}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </Button>
        </div>
      )}

      {/* 关联知识（底部横向卡片列表） */}
      {data.related.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4 text-muted-foreground" />
              关联知识
              <span className="text-xs font-normal text-muted-foreground">
                ({data.related.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.related.map((item) => (
                <RelatedCard key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * 标签药丸组件（展示模式）。
 */
function TagPill({ tag }: { tag: TagItem }) {
  return (
    <span
      className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
      style={
        tag.color
          ? { backgroundColor: `${tag.color}20`, color: tag.color }
          : undefined
      }
    >
      {tag.name}
    </span>
  );
}

/**
 * 标签编辑器组件。
 *
 * 展示所有可用标签供切换选中，并支持创建新标签。
 */
function TagEditor({
  availableTags,
  selectedTagIds,
  newTagName,
  creatingTag,
  onToggleTag,
  onNewTagNameChange,
  onCreateTag,
}: {
  availableTags: TagFilterItem[];
  selectedTagIds: string[];
  newTagName: string;
  creatingTag: boolean;
  onToggleTag: (tagId: string) => void;
  onNewTagNameChange: (name: string) => void;
  onCreateTag: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* 已有标签（点击切换选中） */}
      {availableTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {availableTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(tag.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                )}
                style={
                  !isSelected && tag.color
                    ? { borderColor: `${tag.color}40`, color: tag.color }
                    : undefined
                }
              >
                {isSelected && <CheckCircle2 className="h-3 w-3" />}
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/50">
          暂无可用标签，可在下方创建
        </p>
      )}
      {/* 创建新标签 */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="输入新标签名..."
          value={newTagName}
          onChange={(e) => onNewTagNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCreateTag();
            }
          }}
          maxLength={30}
          className="h-8 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreateTag}
          disabled={creatingTag || !newTagName.trim()}
          className="h-8 shrink-0"
        >
          {creatingTag ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          添加
        </Button>
      </div>
    </div>
  );
}

/**
 * 关联知识卡片组件。
 *
 * 点击跳转到对应知识详情页。
 */
function RelatedCard({ item }: { item: RelatedItem }) {
  return (
    <Link href={`/knowledge/${item.id}`} className="block group">
      <div className="rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:border-primary/30 h-full">
        <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors mb-1">
          {item.title}
        </h4>
        {item.reason && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.reason}
          </p>
        )}
        {item.weight > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/70">
            <Network className="h-3 w-3" />
            关联度 {item.weight.toFixed(2)}
          </div>
        )}
      </div>
    </Link>
  );
}
