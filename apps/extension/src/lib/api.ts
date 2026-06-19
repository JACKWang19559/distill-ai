/**
 * API 通信层。
 *
 * 封装与 Web 端 API 的通信，自动携带 Bearer token 认证。
 */

import { getToken } from "./auth.ts";
import { getApiBaseUrl } from "./storage.ts";
import type { DistillResult } from "@/types/messages.ts";

/** 创建蒸馏任务请求参数 */
interface CreateDistillParams {
  sourceType: "text" | "markdown" | "url";
  content?: string;
  sourceUrl?: string;
}

/** API 错误 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 发起带认证的 fetch 请求。
 *
 * @param path - API 路径（以 / 开头）
 * @param options - fetch 选项
 * @returns 响应 JSON
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiError("未登录，请先登录", "UNAUTHORIZED", 401);
  }

  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new ApiError(
      data.error?.message ?? "请求失败",
      data.error?.code ?? "UNKNOWN",
      res.status
    );
  }

  return data.data as T;
}

/**
 * 创建蒸馏任务。
 *
 * @param params - 蒸馏参数
 * @returns 任务 ID 和知识 ID
 */
export async function createDistillTask(
  params: CreateDistillParams
): Promise<{ taskId: string; knowledgeId: string; status: string }> {
  return apiFetch("/api/distill", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 查询蒸馏任务状态。
 *
 * @param taskId - 任务 ID
 * @returns 蒸馏结果
 */
export async function getDistillStatus(taskId: string): Promise<DistillResult> {
  return apiFetch(`/api/distill/${taskId}`);
}

/**
 * 更新知识（标题、标签）。
 *
 * @param knowledgeId - 知识 ID
 * @param data - 更新数据
 */
export async function updateKnowledge(
  knowledgeId: string,
  data: { title?: string; tagIds?: string[] }
): Promise<unknown> {
  return apiFetch(`/api/knowledge/${knowledgeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * 轮询蒸馏任务直到完成或失败。
 *
 * @param taskId - 任务 ID
 * @param onUpdate - 状态更新回调
 * @param interval - 轮询间隔（毫秒，默认 2000）
 * @param timeout - 超时时间（毫秒，默认 120000）
 * @returns 最终蒸馏结果
 */
export async function pollDistillStatus(
  taskId: string,
  onUpdate?: (result: DistillResult) => void,
  interval = 2000,
  timeout = 120000
): Promise<DistillResult> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startTime > timeout) {
        reject(new ApiError("蒸馏超时", "TIMEOUT", 408));
        return;
      }

      try {
        const result = await getDistillStatus(taskId);
        onUpdate?.(result);

        if (result.status === "completed") {
          resolve(result);
          return;
        }

        if (result.status === "failed") {
          reject(new ApiError("蒸馏失败", "DISTILL_FAILED", 500));
          return;
        }

        // 继续轮询
        setTimeout(poll, interval);
      } catch (err) {
        reject(err);
      }
    };

    poll();
  });
}
