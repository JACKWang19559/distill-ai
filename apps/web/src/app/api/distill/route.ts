/**
 * 蒸馏任务 API 端点。
 *
 * POST /api/distill       创建蒸馏任务（异步处理，立即返回 taskId）
 * GET  /api/distill       获取用户的蒸馏任务列表
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/require-auth";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  createDistillTask,
  processDistillTask,
  listDistillTasks,
} from "@/services/distill.service";

/** 创建蒸馏任务请求体 schema */
const createDistillSchema = z.object({
  sourceType: z.enum(["text", "markdown", "url", "pdf", "douyin", "xiaohongshu"]),
  sourceUrl: z.string().url().optional(),
  content: z.string().min(1).max(500_000).optional(),
  filePath: z.string().optional(),
  useHybrid: z.boolean().optional(),
  cookie: z.string().optional(),
  knowledgeId: z.string().optional(),
}).refine(
  (data) => {
    // text/markdown 必须有 content
    if ((data.sourceType === "text" || data.sourceType === "markdown") && !data.content) {
      return false;
    }
    // url/pdf/douyin/xiaohongshu 必须有 sourceUrl 或 filePath
    if (["url", "pdf", "douyin", "xiaohongshu"].includes(data.sourceType)) {
      if (!data.sourceUrl && !data.filePath) return false;
    }
    return true;
  },
  { message: "输入内容与来源类型不匹配" }
);

/**
 * 创建蒸馏任务。
 *
 * 1. 认证校验
 * 2. 输入校验（Zod）
 * 3. 创建任务（Knowledge + DistillTask）
 * 4. 异步触发蒸馏处理（不阻塞响应）
 * 5. 返回 taskId
 */
export async function POST(request: Request) {
  // 速率限制：每 IP 每分钟最多 10 次蒸馏请求
  const limit = rateLimit(request, { windowMs: 60000, max: 10, keyPrefix: "distill" });
  if (!limit.success) {
    return rateLimitResponse(limit.resetAt);
  }

  try {
    // 1. 认证校验（支持 cookie session 和插件 token）
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    // 2. 输入校验
    const body = await request.json();
    const parseResult = createDistillSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message ?? "输入校验失败",
          },
        },
        { status: 400 }
      );
    }

    // 3. 创建任务
    const { taskId, knowledgeId } = await createDistillTask(
      authResult.userId,
      parseResult.data
    );

    // 4. 异步触发蒸馏处理（fire-and-forget，不 await）
    processDistillTask(taskId).catch((err) => {
      console.error(`[DistillTask ${taskId}] 异步处理异常:`, err);
    });

    // 5. 返回任务 ID
    return NextResponse.json(
      {
        success: true,
        data: { taskId, knowledgeId, status: "pending" },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("创建蒸馏任务失败:", error);
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

/**
 * 获取用户的蒸馏任务列表。
 *
 * Query params: page (default 1), pageSize (default 20)
 */
export async function GET(request: Request) {
  try {
    // 认证校验（支持 cookie session 和插件 token）
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    // 解析分页参数
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20));

    const { tasks, total } = await listDistillTasks(authResult.userId, {
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("获取任务列表失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
