/**
 * 设置页 - API 配置管理。
 *
 * 功能：
 * - LLM 供应商配置（OpenAI/Anthropic/Qwen/DeepSeek/Zhipu/Minimax）
 * - ASR 供应商配置（Groq/OpenAI）用于抖音/小红书视频蒸馏
 * - 查看已有配置列表（API Key 脱敏显示）
 * - 添加/激活/删除配置
 *
 * API Key 使用 AES-256-GCM 加密存储。
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Plus, Trash2, Check, Loader2, KeyRound, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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

/** API 配置类型（前端展示用，apiKey 已脱敏） */
interface ApiConfigItem {
  id: string;
  configType: string;
  provider: string;
  name: string;
  apiKey: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** LLM 供应商选项 */
const LLM_PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-3-5-sonnet-20241022" },
  { value: "qwen", label: "通义千问 (Qwen)", defaultModel: "qwen-plus" },
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { value: "zhipu", label: "智谱 GLM", defaultModel: "glm-4" },
  { value: "minimax", label: "Minimax", defaultModel: "MiniMax-Text-01" },
] as const;

/** ASR 供应商选项 */
const ASR_PROVIDER_OPTIONS = [
  {
    value: "groq",
    label: "Groq（推荐，免费 288 分钟/天）",
    defaultModel: "whisper-large-v3",
    defaultBaseUrl: "https://api.groq.com/openai/v1/audio/transcriptions",
    apiKeyHint: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    value: "openai",
    label: "OpenAI Whisper",
    defaultModel: "whisper-1",
    defaultBaseUrl: "https://api.openai.com/v1/audio/transcriptions",
    apiKeyHint: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
] as const;

/** 供应商显示名映射 */
const LLM_PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  LLM_PROVIDER_OPTIONS.map((p) => [p.value, p.label])
);

const ASR_PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  ASR_PROVIDER_OPTIONS.map((p) => [p.value, p.label])
);

export default function SettingsPage() {
  const [configs, setConfigs] = useState<ApiConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 表单状态
  const [showForm, setShowForm] = useState<"llm" | "asr" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [llmForm, setLlmForm] = useState({
    provider: "openai",
    name: "",
    apiKey: "",
    model: "gpt-4o",
    baseUrl: "",
    isActive: true,
  });
  const [asrForm, setAsrForm] = useState({
    provider: "groq",
    name: "",
    apiKey: "",
    model: "whisper-large-v3",
    baseUrl: "https://api.groq.com/openai/v1/audio/transcriptions",
    isActive: true,
  });

  /** 获取 API 配置列表 */
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-configs");
      const data = await res.json();
      if (data.success) {
        setConfigs(data.data);
      } else {
        setError(data.error?.message ?? "获取配置失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  /** LLM 供应商切换时自动填充默认模型 */
  const handleLlmProviderChange = (provider: string) => {
    const option = LLM_PROVIDER_OPTIONS.find((p) => p.value === provider);
    setLlmForm((prev) => ({
      ...prev,
      provider,
      model: option?.defaultModel ?? prev.model,
    }));
  };

  /** ASR 供应商切换时自动填充默认模型和 API URL */
  const handleAsrProviderChange = (provider: string) => {
    const option = ASR_PROVIDER_OPTIONS.find((p) => p.value === provider);
    setAsrForm((prev) => ({
      ...prev,
      provider,
      model: option?.defaultModel ?? prev.model,
      baseUrl: option?.defaultBaseUrl ?? prev.baseUrl,
    }));
  };

  /** 提交新建配置 */
  const handleSubmit = async (e: React.FormEvent, configType: "llm" | "asr") => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = configType === "llm" ? llmForm : asrForm;

    try {
      const res = await fetch("/api/settings/api-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          configType,
          baseUrl: form.baseUrl || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setShowForm(null);
        if (configType === "llm") {
          setLlmForm({
            provider: "openai",
            name: "",
            apiKey: "",
            model: "gpt-4o",
            baseUrl: "",
            isActive: true,
          });
        } else {
          setAsrForm({
            provider: "groq",
            name: "",
            apiKey: "",
            model: "whisper-large-v3",
            baseUrl: "https://api.groq.com/openai/v1/audio/transcriptions",
            isActive: true,
          });
        }
        await fetchConfigs();
        toast({
          title: "配置已保存",
          description: `${configType === "llm" ? "AI 供应商" : "ASR"} 配置已成功添加`,
          variant: "success",
        });
      } else {
        setError(data.error?.message ?? "创建失败");
        toast({
          title: "保存失败",
          description: data.error?.message ?? "创建失败",
          variant: "error",
        });
      }
    } catch {
      setError("网络错误，请重试");
      toast({
        title: "网络错误",
        description: "请检查网络后重试",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** 激活配置 */
  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/api-configs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchConfigs();
        toast({
          title: "已激活",
          description: "已切换为当前激活的配置",
          variant: "success",
        });
      }
    } catch {
      setError("激活失败");
      toast({
        title: "激活失败",
        variant: "error",
      });
    }
  };

  /** 删除配置 */
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/api-configs/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        await fetchConfigs();
        toast({
          title: "已删除",
          description: "API 配置已删除",
          variant: "success",
        });
      }
    } catch {
      setError("删除失败");
      toast({
        title: "删除失败",
        variant: "error",
      });
    }
  };

  /** 渲染配置列表 */
  const renderConfigList = (configType: "llm" | "asr") => {
    const filtered = configs.filter((c) => c.configType === configType);
    const providerLabels = configType === "llm" ? LLM_PROVIDER_LABELS : ASR_PROVIDER_LABELS;

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
          {configType === "llm" ? (
            <KeyRound className="mx-auto mb-2 h-8 w-8 opacity-50" />
          ) : (
            <Mic className="mx-auto mb-2 h-8 w-8 opacity-50" />
          )}
          <p>暂无{configType === "llm" ? " AI 供应商" : " ASR"}配置</p>
          <p className="mt-1 text-sm">
            点击"添加配置"开始使用{configType === "llm" ? "蒸馏" : "视频蒸馏"}功能
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filtered.map((config) => (
          <div
            key={config.id}
            className={`flex items-center justify-between rounded-lg border p-4 ${
              config.isActive ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{config.name}</span>
                {config.isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    <Check className="h-3 w-3" />
                    已激活
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {providerLabels[config.provider] ?? config.provider} ·{" "}
                {config.model} · {config.apiKey}
              </div>
              {config.baseUrl && (
                <div className="mt-0.5 text-xs text-muted-foreground/70">
                  {config.baseUrl}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!config.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleActivate(config.id)}
                >
                  激活
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label="删除配置"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除 API 配置</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要删除「{config.name}」吗？此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(config.id)}>
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">设置</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* LLM 供应商配置区域 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                AI 供应商配置
              </CardTitle>
              <CardDescription className="mt-1">
                配置 LLM API Key 用于知识蒸馏。支持 OpenAI / Anthropic / Qwen / DeepSeek / 智谱 / Minimax。
              </CardDescription>
            </div>
            {showForm !== "llm" && (
              <Button size="sm" onClick={() => setShowForm("llm")}>
                <Plus className="h-4 w-4" />
                添加配置
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* LLM 新建表单 */}
          {showForm === "llm" && (
            <form onSubmit={(e) => handleSubmit(e, "llm")} className="mb-6 space-y-4 rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="llm-provider">供应商</Label>
                  <select
                    id="llm-provider"
                    value={llmForm.provider}
                    onChange={(e) => handleLlmProviderChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {LLM_PROVIDER_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm-name">配置名称</Label>
                  <Input
                    id="llm-name"
                    value={llmForm.name}
                    onChange={(e) => setLlmForm({ ...llmForm, name: e.target.value })}
                    placeholder="如：我的 OpenAI 账号"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-apiKey">API Key</Label>
                <Input
                  id="llm-apiKey"
                  type="password"
                  value={llmForm.apiKey}
                  onChange={(e) => setLlmForm({ ...llmForm, apiKey: e.target.value })}
                  placeholder="sk-..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="llm-model">模型名称</Label>
                  <Input
                    id="llm-model"
                    value={llmForm.model}
                    onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                    placeholder="gpt-4o"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm-baseUrl">API 地址（可选）</Label>
                  <Input
                    id="llm-baseUrl"
                    value={llmForm.baseUrl}
                    onChange={(e) => setLlmForm({ ...llmForm, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={llmForm.isActive}
                  onChange={(e) => setLlmForm({ ...llmForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                设为当前激活的供应商
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存配置"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(null)}
                >
                  取消
                </Button>
              </div>
            </form>
          )}

          {renderConfigList("llm")}
        </CardContent>
      </Card>

      {/* ASR 供应商配置区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                ASR 语音识别配置
              </CardTitle>
              <CardDescription className="mt-1">
                配置 ASR API Key 用于抖音/小红书视频蒸馏的语音转文字。推荐使用 Groq（免费 288 分钟/天）。
              </CardDescription>
            </div>
            {showForm !== "asr" && (
              <Button size="sm" onClick={() => setShowForm("asr")}>
                <Plus className="h-4 w-4" />
                添加配置
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* ASR 新建表单 */}
          {showForm === "asr" && (
            <form onSubmit={(e) => handleSubmit(e, "asr")} className="mb-6 space-y-4 rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asr-provider">ASR 供应商</Label>
                  <select
                    id="asr-provider"
                    value={asrForm.provider}
                    onChange={(e) => handleAsrProviderChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {ASR_PROVIDER_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asr-name">配置名称</Label>
                  <Input
                    id="asr-name"
                    value={asrForm.name}
                    onChange={(e) => setAsrForm({ ...asrForm, name: e.target.value })}
                    placeholder="如：我的 Groq 账号"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asr-apiKey">API Key</Label>
                <Input
                  id="asr-apiKey"
                  type="password"
                  value={asrForm.apiKey}
                  onChange={(e) => setAsrForm({ ...asrForm, apiKey: e.target.value })}
                  placeholder={asrForm.provider === "groq" ? "gsk_..." : "sk-..."}
                  required
                />
                {asrForm.provider === "groq" && (
                  <p className="text-xs text-muted-foreground">
                    免费 Key 申请：https://console.groq.com/keys
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asr-model">模型名称</Label>
                  <Input
                    id="asr-model"
                    value={asrForm.model}
                    onChange={(e) => setAsrForm({ ...asrForm, model: e.target.value })}
                    placeholder="whisper-large-v3"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asr-baseUrl">ASR API 地址</Label>
                  <Input
                    id="asr-baseUrl"
                    value={asrForm.baseUrl}
                    onChange={(e) => setAsrForm({ ...asrForm, baseUrl: e.target.value })}
                    placeholder="https://api.groq.com/openai/v1/audio/transcriptions"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={asrForm.isActive}
                  onChange={(e) => setAsrForm({ ...asrForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                设为当前激活的 ASR 供应商
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存配置"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(null)}
                >
                  取消
                </Button>
              </div>
            </form>
          )}

          {renderConfigList("asr")}
        </CardContent>
      </Card>
    </div>
  );
}
