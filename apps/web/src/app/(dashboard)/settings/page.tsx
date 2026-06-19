/**
 * 设置页 - API 配置管理。
 *
 * 功能：
 * - 查看已有 API 配置列表（API Key 脱敏显示）
 * - 添加新 API 配置（供应商/名称/Key/模型/地址/激活）
 * - 激活/取消激活配置
 * - 删除配置
 *
 * 支持 5 个供应商：OpenAI / Anthropic / 通义千问 / DeepSeek / 智谱 GLM
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Plus, Trash2, Check, Loader2, KeyRound } from "lucide-react";
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
  provider: string;
  name: string;
  apiKey: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 供应商选项 */
const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-3-5-sonnet-20241022" },
  { value: "qwen", label: "通义千问 (Qwen)", defaultModel: "qwen-plus" },
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { value: "zhipu", label: "智谱 GLM", defaultModel: "glm-4" },
] as const;

/** 供应商显示名映射 */
const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  PROVIDER_OPTIONS.map((p) => [p.value, p.label])
);

export default function SettingsPage() {
  const [configs, setConfigs] = useState<ApiConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    provider: "openai",
    name: "",
    apiKey: "",
    model: "gpt-4o",
    baseUrl: "",
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

  /** 供应商切换时自动填充默认模型 */
  const handleProviderChange = (provider: string) => {
    const option = PROVIDER_OPTIONS.find((p) => p.value === provider);
    setForm((prev) => ({
      ...prev,
      provider,
      model: option?.defaultModel ?? prev.model,
    }));
  };

  /** 提交新建配置 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/api-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          baseUrl: form.baseUrl || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setShowForm(false);
        setForm({
          provider: "openai",
          name: "",
          apiKey: "",
          model: "gpt-4o",
          baseUrl: "",
          isActive: true,
        });
        await fetchConfigs();
        toast({
          title: "配置已保存",
          description: "API 配置已成功添加",
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
          description: "已切换为当前激活的供应商",
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

      {/* API 配置区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                AI 供应商配置
              </CardTitle>
              <CardDescription className="mt-1">
                配置 API Key 后即可使用蒸馏功能。API Key 使用 AES-256-GCM 加密存储。
              </CardDescription>
            </div>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                添加配置
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 新建表单 */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">供应商</Label>
                  <select
                    id="provider"
                    value={form.provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PROVIDER_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">配置名称</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：我的 OpenAI 账号"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="sk-..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="model">模型名称</Label>
                  <Input
                    id="model"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="gpt-4o"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">API 地址（可选）</Label>
                  <Input
                    id="baseUrl"
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
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
                  onClick={() => setShowForm(false)}
                >
                  取消
                </Button>
              </div>
            </form>
          )}

          {/* 配置列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : configs.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
              <KeyRound className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>暂无 API 配置</p>
              <p className="mt-1 text-sm">点击"添加配置"开始使用蒸馏功能</p>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
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
                      {PROVIDER_LABELS[config.provider] ?? config.provider} ·{" "}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
