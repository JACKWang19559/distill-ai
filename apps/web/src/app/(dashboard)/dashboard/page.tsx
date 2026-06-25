/**
 * 首页 - 快速蒸馏。
 *
 * 功能：
 * - 文本/URL 输入 → 提交蒸馏
 * - 轮询任务状态 → 展示进度
 * - 蒸馏完成 → 展示结构化结果（标题/摘要/关键点/大纲/标签）
 * - 自动保存到知识库（后端已处理）
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  FileText,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  File as FilePdf,
  CheckCircle2,
  AlertCircle,
  Tag,
  ListTree,
  Quote,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUpload, type UploadedFile } from "@/components/distill/file-upload";
import { LinkInput } from "@/components/distill/link-input";

/** 输入模式 */
type InputMode = "text" | "url" | "pdf" | "douyin" | "xiaohongshu";

/** Tab 配置 */
const TABS: Array<{ mode: InputMode; label: string; icon: typeof FileText }> = [
  { mode: "text", label: "文本", icon: FileText },
  { mode: "url", label: "网页", icon: LinkIcon },
  { mode: "pdf", label: "PDF", icon: FilePdf },
  { mode: "douyin", label: "抖音", icon: Video },
  { mode: "xiaohongshu", label: "小红书", icon: ImageIcon },
];

/** 蒸馏状态 */
type DistillState = "idle" | "submitting" | "processing" | "completed" | "failed";

/** 蒸馏结果（从 API 返回） */
interface DistillResultData {
  title: string;
  summary: string;
  keyPoints: string[];
  outline: string;
  entities?: Array<{ name: string; type: string }>;
  suggestedTags: string[];
}

/** 任务状态响应 */
interface TaskStatusResponse {
  taskId: string;
  status: string;
  knowledgeId: string | null;
  errorMessage: string | null;
  knowledge: {
    id: string;
    title: string;
    distilledData: DistillResultData;
    tags: Array<{ id: string; name: string; color: string | null }>;
  } | null;
}

export default function DashboardPage() {
  const [mode, setMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [pdfFilePath, setPdfFilePath] = useState<string | null>(null);
  /** PDF 直传媒体服务后的 Markdown 内容（绕过 Vercel 4.5MB 限制） */
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  /** PDF 直传后的页数（用于标题展示） */
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [useHybrid, setUseHybrid] = useState(false);
  const [douyinUrl, setDouyinUrl] = useState("");
  const [douyinCookie, setDouyinCookie] = useState("");
  const [xhsUrl, setXhsUrl] = useState("");
  const [xhsCookie, setXhsCookie] = useState("");
  const [state, setState] = useState<DistillState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DistillResultData | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<string>("pending");
  const [lastSubmitBody, setLastSubmitBody] = useState<Record<string, unknown> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  /** 组件卸载时关闭 EventSource */
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  /** 通过 SSE 流式监听任务状态 */
  const subscribeStatus = useCallback((id: string) => {
    // 关闭已有的 EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/distill/${id}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: TaskStatusResponse = JSON.parse(event.data);
        setSseStatus(data.status);

        if (data.status === "completed") {
          setState("completed");
          if (data.knowledge?.distilledData) {
            setResult(data.knowledge.distilledData);
          }
          eventSource.close();
          eventSourceRef.current = null;
          return;
        }

        if (data.status === "failed") {
          setState("failed");
          setError(data.errorMessage ?? "蒸馏失败");
          eventSource.close();
          eventSourceRef.current = null;
          return;
        }

        // pending / processing：更新 taskId 显示
        setTaskId(data.taskId);
      } catch {
        // 忽略解析错误
      }
    };

    eventSource.onerror = () => {
      // SSE 连接错误（可能是网络问题或连接关闭）
      setState((prev) => {
        // 只有在 processing 状态才标记失败，避免覆盖已完成状态
        if (prev === "processing") {
          setError("连接中断，请刷新重试");
          return "failed";
        }
        return prev;
      });
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  /** 构建请求体 */
  const buildRequestBody = useCallback((): Record<string, unknown> => {
    switch (mode) {
      case "text":
        return { sourceType: "text", content };
      case "url":
        return { sourceType: "url", sourceUrl: url };
      case "pdf":
        // 优先使用直传到媒体服务后返回的 Markdown 内容（绕过 Vercel 4.5MB 限制）
        // 回退到 filePath（旧链路，仅适用于 < 4.5MB 的文件）
        return {
          sourceType: "pdf",
          ...(pdfContent
            ? { content: pdfContent, pageCount: pdfPageCount ?? 0 }
            : { filePath: pdfFilePath }),
          useHybrid,
        };
      case "douyin":
        return {
          sourceType: "douyin",
          sourceUrl: douyinUrl,
          ...(douyinCookie ? { cookie: douyinCookie } : {}),
        };
      case "xiaohongshu":
        return {
          sourceType: "xiaohongshu",
          sourceUrl: xhsUrl,
          ...(xhsCookie ? { cookie: xhsCookie } : {}),
        };
      default:
        throw new Error("不支持的输入模式");
    }
  }, [mode, content, url, pdfFilePath, pdfContent, pdfPageCount, useHybrid, douyinUrl, douyinCookie, xhsUrl, xhsCookie]);

  /** 提交蒸馏任务（内部复用，支持重试） */
  const submitDistill = useCallback(async (body: Record<string, unknown>) => {
    setState("submitting");
    setError(null);
    setResult(null);
    setLastSubmitBody(body);

    try {
      const res = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message ?? "创建任务失败");
      }

      setTaskId(data.data.taskId);
      setSseStatus("pending");
      setState("processing");
      // 开始 SSE 流式监听
      subscribeStatus(data.data.taskId);
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : "未知错误");
    }
  }, [subscribeStatus]);

  /** 提交蒸馏任务 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = buildRequestBody();
      await submitDistill(body);
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : "未知错误");
    }
  };

  /** 重试上一次蒸馏 */
  const handleRetry = () => {
    if (lastSubmitBody) {
      submitDistill(lastSubmitBody);
    }
  };

  /** 重置表单 */
  const handleReset = () => {
    setState("idle");
    setResult(null);
    setTaskId(null);
    setSseStatus("pending");
    setLastSubmitBody(null);
    setError(null);
    setContent("");
    setUrl("");
    setPdfFilePath(null);
    setUseHybrid(false);
    setDouyinUrl("");
    setDouyinCookie("");
    setXhsUrl("");
    setXhsCookie("");
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  /** 是否可提交 */
  const canSubmit =
    state === "idle" &&
    ((mode === "text" && content.trim().length > 0) ||
      (mode === "url" && url.trim().length > 0) ||
      (mode === "pdf" && (Boolean(pdfContent) || Boolean(pdfFilePath))) ||
      (mode === "douyin" && douyinUrl.trim().length > 0) ||
      (mode === "xiaohongshu" && xhsUrl.trim().length > 0));

  return (
    <div className="mx-auto max-w-4xl animate-fade-in-up">
      {/* 标题 */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 md:h-16 md:w-16">
          <Sparkles className="h-7 w-7 text-primary md:h-8 md:w-8" />
        </div>
        <h1 className="text-2xl font-bold md:text-3xl">AI 知识蒸馏</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          一键导入任何格式信息源，AI 蒸馏核心要点，实现输入即内化
        </p>
      </div>

      {/* 蒸馏表单 */}
      {(state === "idle" || state === "submitting") && (
        <Card>
          <CardHeader>
            {/* Tab 切换 */}
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.mode}
                    variant={mode === tab.mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode(tab.mode)}
                    aria-pressed={mode === tab.mode}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="content">粘贴文本内容</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="粘贴文章、笔记、任何你想蒸馏的文本..."
                    className="min-h-[200px]"
                    required
                  />
                </div>
              )}

              {mode === "url" && (
                <div className="space-y-2">
                  <Label htmlFor="url">网页链接</Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    required
                  />
                </div>
              )}

              {mode === "pdf" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>上传 PDF 文件</Label>
                    <FileUpload
                      accept=".pdf"
                      maxSize={50 * 1024 * 1024}
                      directUpload
                      useHybrid={useHybrid}
                      onDirectUploaded={(result) => {
                        setPdfContent(result.content);
                        setPdfPageCount(result.pageCount);
                      }}
                      onClear={() => {
                        setPdfContent(null);
                        setPdfPageCount(null);
                        setPdfFilePath(null);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      文件直接上传到媒体服务处理，支持最大 50MB，绕过 Vercel 4.5MB 限制
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={useHybrid}
                      onChange={(e) => setUseHybrid(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    启用混合模式（Hybrid，OCR + 文本提取）
                  </label>
                </div>
              )}

              {mode === "douyin" && (
                <LinkInput
                  label="抖音视频链接"
                  placeholder="https://www.douyin.com/video/..."
                  url={douyinUrl}
                  cookie={douyinCookie}
                  onUrlChange={setDouyinUrl}
                  onCookieChange={setDouyinCookie}
                />
              )}

              {mode === "xiaohongshu" && (
                <LinkInput
                  label="小红书笔记链接"
                  placeholder="https://www.xiaohongshu.com/explore/..."
                  url={xhsUrl}
                  cookie={xhsCookie}
                  onUrlChange={setXhsUrl}
                  onCookieChange={setXhsCookie}
                />
              )}

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full"
                size="lg"
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    开始蒸馏
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 处理中 */}
      {state === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <h3 className="text-lg font-medium">
              {sseStatus === "pending" ? "任务已创建，排队中..." : "AI 正在蒸馏中..."}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {sseStatus === "pending"
                ? "正在等待处理资源就绪"
                : "正在分析内容、提取关键点、生成结构化摘要"}
            </p>
            {taskId && (
              <p className="mt-2 text-xs text-muted-foreground/60">
                任务 ID: {taskId}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 蒸馏失败 */}
      {state === "failed" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="text-lg font-medium">蒸馏失败</h3>
            <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>
            <div className="mt-4 flex gap-2">
              {lastSubmitBody && (
                <Button onClick={handleRetry} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重试
                </Button>
              )}
              <Button onClick={handleReset} variant="outline">
                重新开始
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 蒸馏结果 */}
      {state === "completed" && result && (
        <div className="space-y-4">
          {/* 成功提示 */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-medium">蒸馏完成，已自动保存到知识库</p>
              </div>
              <Button onClick={handleReset} variant="outline" size="sm">
                继续蒸馏
              </Button>
            </CardContent>
          </Card>

          {/* 标题 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{result.title}</CardTitle>
            </CardHeader>
          </Card>

          {/* 摘要 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Quote className="h-4 w-4 text-primary" />
                核心摘要
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {result.summary}
              </p>
            </CardContent>
          </Card>

          {/* 关键点 */}
          {result.keyPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  关键要点
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 大纲 */}
          {result.outline && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListTree className="h-4 w-4 text-primary" />
                  内容大纲
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {result.outline}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* 标签 */}
          {result.suggestedTags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4 text-primary" />
                  推荐标签
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.suggestedTags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
