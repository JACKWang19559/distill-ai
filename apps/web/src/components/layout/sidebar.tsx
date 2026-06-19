"use client";

/**
 * 侧边栏组件。
 *
 * 包含主导航菜单：首页、知识库、搜索、知识图谱、设置。
 * 使用 lucide-react 图标，高亮当前活跃路由。
 *
 * 响应式行为：
 * - 桌面端（md+）：始终可见，静态定位，占据左侧固定宽度。
 * - 移动端（< md）：默认隐藏，通过 isOpen 控制滑入/滑出，
 *   点击导航项后自动关闭。
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Library,
  Search,
  Network,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 导航项配置。
 */
const NAV_ITEMS = [
  { href: "/dashboard", label: "首页", icon: Home },
  { href: "/library", label: "知识库", icon: Library },
  { href: "/search", label: "搜索", icon: Search },
  { href: "/graph", label: "知识图谱", icon: Network },
  { href: "/settings", label: "设置", icon: Settings },
] as const;

/** Sidebar 组件属性 */
interface SidebarProps {
  /** 移动端是否展开 */
  isOpen: boolean;
  /** 关闭侧边栏回调（点击导航项或遮罩时触发） */
  onClose: () => void;
}

/**
 * 侧边栏导航组件。
 *
 * @param isOpen - 移动端展开状态
 * @param onClose - 关闭回调
 * @returns 侧边栏 JSX
 */
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-60 flex-col border-r bg-card transition-transform duration-300 ease-in-out md:static md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo 区域 */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Distill</span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 底部信息 */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          AI 知识蒸馏站 v0.1.0
        </p>
      </div>
    </aside>
  );
}
