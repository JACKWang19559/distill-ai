"use client";

/**
 * 顶栏组件。
 *
 * 包含搜索框和用户菜单（头像 + 下拉菜单：设置/退出登录）。
 *
 * 响应式行为：
 * - 移动端（< md）：显示汉堡菜单按钮，搜索框自适应宽度。
 * - 桌面端（md+）：隐藏汉堡按钮，搜索框保持最大宽度限制。
 */
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, LogOut, Settings as SettingsIcon, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Header 组件属性 */
interface HeaderProps {
  /** 汉堡菜单点击回调（仅移动端使用） */
  onMenuClick: () => void;
}

/**
 * 顶栏组件。
 *
 * @param onMenuClick - 汉堡菜单点击回调
 * @returns Header JSX
 */
export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();

  /**
   * 处理搜索提交。
   *
   * @param e - 表单事件
   */
  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("query") as string;
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  /**
   * 获取用户名首字母作为头像回退。
   */
  function getInitials(name?: string | null): string {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  }

  return (
    <header className="flex h-16 items-center gap-2 border-b bg-card px-4 md:gap-4 md:px-6">
      {/* 汉堡菜单按钮（仅移动端显示） */}
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* 搜索框 - 自适应宽度 */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="query"
            type="search"
            placeholder="搜索知识库..."
            className="pl-9"
          />
        </div>
      </form>

      {/* 用户菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Avatar>
            {session?.user?.image && (
              <AvatarImage
                src={session.user.image}
                alt={session.user.name || "用户头像"}
              />
            )}
            <AvatarFallback>
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {session?.user?.name || "用户"}
              </span>
              <span className="text-xs text-muted-foreground">
                {session?.user?.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <SettingsIcon className="mr-2 h-4 w-4" />
            设置
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
