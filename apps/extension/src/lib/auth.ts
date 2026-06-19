/**
 * 登录态管理。
 *
 * 通过 chrome.storage.local 存储 API token，提供登录、登出、状态检查功能。
 */

import { getStorage, setStorage, removeStorage, getApiBaseUrl } from "./storage.ts";
import type { StorageData } from "./storage.ts";

/** 登录请求参数 */
interface LoginParams {
  email: string;
  password: string;
}

/** 登录响应数据 */
interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
  };
  error?: { code: string; message: string };
}

/**
 * 登录：邮箱密码换取 API token。
 *
 * @param params - 邮箱和密码
 * @returns 登录成功返回用户信息，失败抛出错误
 */
export async function login(params: LoginParams): Promise<{
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}> {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/extension-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data: LoginResponse = await res.json();

  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error?.message ?? "登录失败");
  }

  // 存储 token 和用户信息
  await setStorage({
    token: data.data.token,
    user: data.data.user,
  });

  return data.data.user;
}

/**
 * 登出：吊销 token 并清除本地存储。
 */
export async function logout(): Promise<void> {
  const { token } = await getStorage(["token"]);

  if (token) {
    const baseUrl = await getApiBaseUrl();
    // 尝试通知服务端吊销 token（失败不阻塞登出）
    try {
      await fetch(`${baseUrl}/api/auth/extension-login`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch {
      // 忽略网络错误
    }
  }

  await removeStorage(["token", "user"]);
}

/**
 * 检查是否已登录。
 *
 * @returns 已登录返回 true
 */
export async function isLoggedIn(): Promise<boolean> {
  const { token } = await getStorage(["token"]);
  return !!token;
}

/**
 * 获取当前 token。
 *
 * @returns token 字符串，未登录返回 null
 */
export async function getToken(): Promise<string | null> {
  const { token } = await getStorage(["token"]);
  return token ?? null;
}

/**
 * 获取当前用户信息。
 */
export async function getCurrentUser(): Promise<StorageData["user"]> {
  const { user } = await getStorage(["user"]);
  return user;
}
