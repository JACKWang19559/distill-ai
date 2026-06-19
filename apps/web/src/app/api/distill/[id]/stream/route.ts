/**
 * 蒸馏任务流式进度 API（SSE）。
 *
 * GET /api/distill/[id]/stream
 *   返回 text/event-stream，实时推送蒸馏任务状态变化。
 *   状态变为 completed/failed 后推送最终结果并关闭连接。
 *
 * 事件格式：
 *   data: {"status":"pending","taskId":"...","knowledgeId":"..."}
 *   data: {"status":"processing","taskId":"...","knowledgeId":"..."}
 *   data: {"status":"completed","taskId":"...","knowledge":{...}}
 *   data: {"status":"failed","taskId":"...","errorMessage":"..."}
 */

import { requireAuth, unauthorizedResponse } from "@/lib/auth/require-auth";
import { getDistillStatus } from "@/services/distill.service";
import { prisma } from "@/lib/db";

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 1500;
/** 最大连接时长（毫秒，3 分钟） */
const MAX_DURATION = 180_000;

/**
 * SSE 流式端点。
 *
 * 通过 ReadableStream 实现 Server-Sent Events，每 1.5 秒查询 DB 状态并推送。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 认证校验（支持 cookie session 和插件 token）
  const authResult = await requireAuth(request);
  if (!authResult) {
    return unauthorizedResponse();
  }

  const { id: taskId } = await params;

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = "";

      /** 推送 SSE 事件 */
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      /** 轮询并发送状态 */
      const poll = async () => {
        // 超时检查
        if (Date.now() - startTime > MAX_DURATION) {
          sendEvent({
            taskId,
            status: "failed",
            errorMessage: "蒸馏超时",
          });
          controller.close();
          return;
        }

        try {
          const status = await getDistillStatus(taskId, authResult.userId);

          // 状态变化时推送
          if (status.status !== lastStatus) {
            lastStatus = status.status;

            if (status.status === "completed" && status.knowledgeId) {
              // 查询蒸馏结果
              const knowledge = await prisma.knowledge.findFirst({
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
                  tags: { include: { tag: true } },
                },
              });

              sendEvent({
                taskId: status.taskId,
                status: "completed",
                knowledgeId: status.knowledgeId,
                knowledge: knowledge
                  ? {
                      ...knowledge,
                      tags: knowledge.tags.map((kt) => kt.tag),
                    }
                  : null,
              });
              controller.close();
              return;
            }

            if (status.status === "failed") {
              sendEvent({
                taskId: status.taskId,
                status: "failed",
                knowledgeId: status.knowledgeId,
                errorMessage: status.errorMessage,
              });
              controller.close();
              return;
            }

            // pending / processing
            sendEvent({
              taskId: status.taskId,
              status: status.status,
              knowledgeId: status.knowledgeId,
            });
          }

          // 继续轮询
          setTimeout(poll, POLL_INTERVAL);
        } catch (err) {
          sendEvent({
            taskId,
            status: "failed",
            errorMessage: err instanceof Error ? err.message : "查询状态失败",
          });
          controller.close();
        }
      };

      // 立即推送一次初始状态
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
