/**
 * KnowledgeCard 组件 - 知识库卡片视图。
 *
 * 展示单条知识的摘要信息：
 * - 来源类型图标 + 标签
 * - 标题（可点击跳转详情）
 * - 摘要（截断显示）
 * - 标签列表
 * - 创建时间
 * - 蒸馏状态徽章
 */

"use client";

import Link from "next/link";
import {
  FileText,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  FileCode,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Hourglass,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** 来源类型配置：图标 + 标签 */
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

/** 蒸馏状态配置：图标 + 标签 + 颜色 */
const STATUS_CONFIG: Record<
  string,
  { icon: typeof FileText; label: string; color: string }
> = {
  completed: { icon: CheckCircle2, label: "已完成", color: "text-green-500" },
  processing: { icon: Loader2, label: "处理中", color: "text-blue-500" },
  pending: { icon: Hourglass, label: "等待中", color: "text-yellow-500" },
  failed: { icon: AlertCircle, label: "失败", color: "text-red-500" },
};

/** 知识列表项类型（与 knowledge.service.ts 对应） */
export interface KnowledgeItem {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  distilledData: Record<string, unknown>;
  mediaMeta: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
  tags: Array<{ id: string; name: string; color: string | null }>;
}

/** 格式化日期为简短中文格式 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 从 distilledData 安全提取摘要 */
function getSummary(distilledData: Record<string, unknown>): string {
  const summary = distilledData?.summary;
  return typeof summary === "string" ? summary : "";
}

/** KnowledgeCard 属性 */
interface KnowledgeCardProps {
  /** 知识列表项 */
  item: KnowledgeItem;
}

/**
 * 知识卡片组件。
 *
 * 用于知识库列表页的卡片视图，展示知识的核心摘要信息。
 * 点击标题可跳转到知识详情页。
 */
export function KnowledgeCard({ item }: KnowledgeCardProps) {
  const sourceConfig = SOURCE_CONFIG[item.sourceType] ?? SOURCE_CONFIG.text;
  const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const summary = getSummary(item.distilledData);
  const SourceIcon = sourceConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Link href={`/knowledge/${item.id}`} className="block group">
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
        <CardHeader className="pb-3">
          {/* 来源类型 + 状态 */}
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <SourceIcon className={`h-3.5 w-3.5 ${sourceConfig.color}`} />
              {sourceConfig.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs ${statusConfig.color}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${item.status === "processing" ? "animate-spin" : ""}`} />
              {statusConfig.label}
            </span>
          </div>
          {/* 标题 */}
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 摘要 */}
          {summary ? (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">
              暂无摘要
            </p>
          )}
          {/* 标签 */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                  style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
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
          )}
          {/* 时间 */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground/70 pt-1">
            <Clock className="h-3 w-3" />
            {formatDate(item.createdAt)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
