/**
 * 链接输入组件（抖音/小红书）。
 *
 * 提供 URL 输入框 + 可选 Cookie 输入。
 */

"use client";

import { useState } from "react";
import { Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface LinkInputProps {
  /** 链接类型标识（用于显示） */
  label: string;
  /** 占位符 */
  placeholder?: string;
  /** URL 变化回调 */
  onUrlChange: (url: string) => void;
  /** Cookie 变化回调 */
  onCookieChange?: (cookie: string) => void;
  /** URL 值 */
  url: string;
  /** Cookie 值 */
  cookie?: string;
}

export function LinkInput({
  label,
  placeholder = "请输入链接",
  onUrlChange,
  onCookieChange,
  url,
  cookie = "",
}: LinkInputProps) {
  const [showCookie, setShowCookie] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          {label}
        </Label>
        <Input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-gray-500"
        onClick={() => setShowCookie(!showCookie)}
      >
        {showCookie ? (
          <ChevronUp className="mr-1 h-3 w-3" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3" />
        )}
        {showCookie ? "收起 Cookie" : "展开 Cookie（可选，用于反爬）"}
      </Button>

      {showCookie && onCookieChange && (
        <div className="space-y-2">
          <Label htmlFor="cookie" className="text-xs text-gray-500">
            Cookie（抖音/小红书反爬必需）
          </Label>
          <Textarea
            id="cookie"
            value={cookie}
            onChange={(e) => onCookieChange(e.target.value)}
            placeholder="粘贴浏览器 Cookie"
            className="min-h-[80px] text-xs"
          />
          <p className="text-xs text-muted-foreground">
            获取方法：在浏览器中打开抖音/小红书并登录，按 F12 打开开发者工具 → Network → 刷新页面 → 点击任意请求 → 复制 Request Headers 中的 Cookie 值粘贴到此处。
          </p>
        </div>
      )}
    </div>
  );
}
