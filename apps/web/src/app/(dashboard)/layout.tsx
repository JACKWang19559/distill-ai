"use client";

/**
 * Dashboard 布局。
 *
 * 包含侧边栏 + 顶栏，所有 (dashboard) 路由组下的页面共享此布局。
 * 未登录用户会被中间件重定向到 /login。
 *
 * 移动端（< 768px）侧边栏默认隐藏，通过汉堡菜单切换显示，
 * 点击遮罩或导航项后自动关闭。
 */
import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

/**
 * Dashboard 布局组件。
 *
 * @param children - 子页面内容
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /** 打开移动端侧边栏 */
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  /** 关闭移动端侧边栏 */
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 移动端遮罩：侧边栏打开时显示，点击关闭 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={openSidebar} />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
