"use client";

/**
 * NextAuth SessionProvider 包装组件。
 *
 * 在客户端组件中提供 useSession() hook 支持。
 * 在根布局中包裹整个应用。
 */
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * SessionProvider 包装器。
 *
 * @param props.children - 子组件
 * @returns 包裹 SessionProvider 的组件树
 */
export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
