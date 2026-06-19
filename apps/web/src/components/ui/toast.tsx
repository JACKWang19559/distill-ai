"use client";

/**
 * Toast 轻量通知组件。
 *
 * 基于 @radix-ui/react-toast 封装，遵循 shadcn/ui new-york 风格。
 * 用于非阻塞式的成功/错误/信息反馈（替代 window.alert）。
 *
 * 使用方式：
 * 1. 在根布局包裹 <ToastProvider />
 * 2. 在任意组件中调用 useToast() 获取 toast 函数
 * 3. toast({ title: "成功", description: "操作完成", variant: "success" })
 *
 * Toast 自动在 5 秒后消失，支持手动关闭。
 */
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

/** Toast 上下文类型 */
interface ToastContextValue {
  /** 显示 toast */
  toast: (props: ToastProps) => void;
}

/** Toast 属性 */
interface ToastProps {
  /** 标题 */
  title: string;
  /** 描述文本 */
  description?: string;
  /** 变体：成功/错误/警告/信息 */
  variant?: "default" | "success" | "error" | "warning" | "info";
  /** 持续时间（毫秒），默认 5000 */
  duration?: number;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** Toast 视图数据 */
interface ToastItem extends ToastProps {
  id: string;
}

/** Toast Provider 组件 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  /** 添加 toast */
  const toast = React.useCallback((props: ToastProps) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...props, id }]);
  }, []);

  /** 移除 toast */
  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitives.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive
            key={t.id}
            duration={t.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) removeToast(t.id);
            }}
          >
            <ToastContent variant={t.variant ?? "default"}>
              {t.title}
              {t.description}
            </ToastContent>
          </ToastPrimitive>
        ))}
        <ToastViewport />
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  );
}

/**
 * useToast Hook。
 *
 * 必须在 ToastProvider 内部使用。
 *
 * @returns toast 函数
 */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast 必须在 ToastProvider 内部使用");
  }
  return ctx;
}

/** Toast 根组件 */
const ToastPrimitive = ToastPrimitives.Root;

/** Toast 视口（定位容器） */
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[400px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

/** Toast 变体样式 */
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        success: "border-emerald-200 bg-emerald-50 text-emerald-900",
        error: "border-red-200 bg-red-50 text-red-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        info: "border-blue-200 bg-blue-50 text-blue-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/** Toast 变体图标映射 */
const TOAST_ICONS: Record<string, React.ElementType> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

/**
 * Toast 内容组件（内部使用）。
 */
function ToastContent({
  variant,
  children,
}: {
  variant: "default" | "success" | "error" | "warning" | "info";
  children: React.ReactNode;
}) {
  const Icon = TOAST_ICONS[variant] ?? Info;
  const iconColor = {
    default: "text-muted-foreground",
    success: "text-emerald-600",
    error: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
  }[variant];

  return (
    <div className={cn(toastVariants({ variant }))}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
      <div className="flex-1 space-y-1">
        {typeof children === "string" ? (
          <p className="text-sm font-medium">{children}</p>
        ) : (
          children
        )}
      </div>
      <ToastPrimitives.Close className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </ToastPrimitives.Close>
    </div>
  );
}

export { type ToastProps };
