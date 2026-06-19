/**
 * 蒸馏任务详情 API 端点。
 *
 * GET /api/distill/[id]    查询蒸馏任务状态
 */

import { NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/require-auth";
import { getDistillStatus } from "@/services/distill.service";
import { prisma } from "@/lib/db";

/**
 * 查询蒸馏任务状态。
 *
 * 返回任务状态 + 蒸馏结果（如果已完成）。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证校验（支持 cookie session 和插件 token）
    const authResult = await requireAuth(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    const { id: taskId } = await params;

    // 查询任务状态
    const status = await getDistillStatus(taskId, authResult.userId);

    // 如果任务已完成，附带蒸馏结果
    let knowledge = null;
    if (status.knowledgeId && status.status === "completed") {
      const k = await prisma.knowledge.findFirst({
        where: { id: status.knowledgeId, userId: authResult.userId },
        select: {
          id: true,
          title: true,
          sourceType: true,
          sourceUrl: true,
          distilledData: true,
          status: true,
          mediaMeta: true,
          createdAt: true,
          tags: {
            include: { tag: true },
          },
        },
      });

      if (k) {
        knowledge = {
          ...k,
          tags: k.tags.map((kt) => kt.tag),
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        knowledge,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    const status = message.includes("不存在") || message.includes("无权") ? 404 : 500;
    return NextResponse.json(
      { success: false, error: { code: status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR", message } },
      { status }
    );
  }
}
