/**
 * 文件上传组件。
 *
 * 支持两种模式：
 * - 默认模式：上传到 /api/upload（受 Vercel 4.5MB 限制，仅用于小文件）
 * - directUpload 模式：直接上传到媒体服务 /pdf/extract（绕过 Vercel 限制，用于大 PDF）
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { UploadCloud, File as FileIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PUBLIC_MEDIA_SERVICE_URL } from "@/lib/config";

/** 上传文件状态 */
type UploadState = "idle" | "uploading" | "success" | "error";

/** 已上传文件信息（默认模式） */
export interface UploadedFile {
  /** 服务端文件路径 */
  filePath: string;
  /** 原始文件名 */
  fileName: string;
  /** 文件大小（字节） */
  size: number;
}

/** 直传到媒体服务后返回的解析结果 */
export interface DirectUploadResult {
  /** 原始文件名 */
  fileName: string;
  /** 文件大小（字节） */
  size: number;
  /** PDF 解析后的 Markdown 文本 */
  content: string;
  /** 页数 */
  pageCount: number;
  /** 是否使用了 Hybrid 模式 */
  usedHybrid: boolean;
}

interface FileUploadProps {
  /** 上传完成回调（默认模式） */
  onUploaded?: (file: UploadedFile) => void;
  /** 直传完成回调（directUpload 模式） */
  onDirectUploaded?: (result: DirectUploadResult) => void;
  /** 清除回调 */
  onClear?: () => void;
  /** 接受的文件类型 */
  accept?: string;
  /** 最大文件大小（字节） */
  maxSize?: number;
  /** 是否直传到媒体服务（绕过 Vercel 限制） */
  directUpload?: boolean;
  /** 是否启用 Hybrid 模式（仅 directUpload 时生效） */
  useHybrid?: boolean;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUpload({
  onUploaded,
  onDirectUploaded,
  onClear,
  accept = ".pdf,.txt,.md",
  maxSize = 20 * 1024 * 1024,
  directUpload = false,
  useHybrid = false,
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<
    UploadedFile | DirectUploadResult | null
  >(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  /** 上传文件到媒体服务 /pdf/extract（绕过 Vercel 4.5MB 限制） */
  const uploadToMediaService = useCallback(
    (file: File) => {
      setState("uploading");
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("use_hybrid", String(useHybrid));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      // 进度监听
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      // 完成监听
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const result: DirectUploadResult = {
              fileName: file.name,
              size: file.size,
              content: data.markdown ?? "",
              pageCount: data.page_count ?? 0,
              usedHybrid: data.used_hybrid ?? false,
            };
            setUploadedFile(result);
            setState("success");
            onDirectUploaded?.(result);
          } catch {
            setError("解析媒体服务响应失败");
            setState("error");
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            setError(data.detail ?? `上传失败 (HTTP ${xhr.status})`);
          } catch {
            setError(`上传失败 (HTTP ${xhr.status})`);
          }
          setState("error");
        }
      });

      // 错误监听
      xhr.addEventListener("error", () => {
        // 提供更具体的错误提示，帮助排查配置问题
        if (PUBLIC_MEDIA_SERVICE_URL.includes("localhost")) {
          setError(
            "网络错误：媒体服务地址指向 localhost，生产环境需配置 NEXT_PUBLIC_MEDIA_SERVICE_URL 环境变量"
          );
        } else {
          setError(
            `网络错误，无法连接媒体服务 (${PUBLIC_MEDIA_SERVICE_URL})。请检查服务是否运行或 CORS 配置`
          );
        }
        setState("error");
      });

      xhr.open("POST", `${PUBLIC_MEDIA_SERVICE_URL}/pdf/extract`);
      xhr.send(formData);
    },
    [useHybrid, onDirectUploaded]
  );

  /** 上传文件到 /api/upload（默认模式，受 Vercel 4.5MB 限制） */
  const uploadToApi = useCallback(
    (file: File) => {
      setState("uploading");
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      // 进度监听
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      // 完成监听
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            const uploaded: UploadedFile = response.data;
            setUploadedFile(uploaded);
            setState("success");
            onUploaded?.(uploaded);
          } else {
            setError(response.error?.message ?? "上传失败");
            setState("error");
          }
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            setError(response.error?.message ?? `上传失败 (HTTP ${xhr.status})`);
          } catch {
            setError(`上传失败 (HTTP ${xhr.status})`);
          }
          setState("error");
        }
      });

      // 错误监听
      xhr.addEventListener("error", () => {
        setError("网络错误，上传失败");
        setState("error");
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    },
    [onUploaded]
  );

  /** 上传文件（根据 directUpload 路由到不同实现） */
  const uploadFile = useCallback(
    (file: File) => {
      // 校验大小
      if (file.size > maxSize) {
        setError(`文件大小超过限制（最大 ${formatSize(maxSize)}）`);
        setState("error");
        return;
      }

      if (directUpload) {
        uploadToMediaService(file);
      } else {
        uploadToApi(file);
      }
    },
    [maxSize, directUpload, uploadToMediaService, uploadToApi]
  );

  /** 处理文件选择 */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  /** 处理拖拽 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  /** 处理拖拽悬停 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  /** 清除已上传文件 */
  const handleClear = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setUploadedFile(null);
    setState("idle");
    setError(null);
    setProgress(0);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onClear?.();
  };

  // 已上传成功：显示文件信息
  if (state === "success" && uploadedFile) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
        <FileIcon className="h-8 w-8 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-green-900">
            {uploadedFile.fileName}
          </p>
          <p className="text-xs text-green-600">{formatSize(uploadedFile.size)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // 上传中 / 空闲：显示拖拽区域
  return (
    <div>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
          state === "uploading"
            ? "border-blue-300 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100",
          state === "error" && "border-red-300 bg-red-50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {state === "uploading" ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-blue-600">上传中... {progress}%</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              点击或拖拽文件到此处上传
            </p>
            <p className="text-xs text-gray-400">
              支持 PDF / TXT / MD，最大 {formatSize(maxSize)}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
