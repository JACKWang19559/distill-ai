/**
 * API 配置更新与删除端点。
 *
 * PATCH  /api/settings/api-configs/[id]    更新 API 配置
 * DELETE /api/settings/api-configs/[id]    删除 API 配置
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

/** 更新 API 配置 schema */
const updateConfigSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  apiKey: z.string().min(1).max(500).optional(),
  model: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * 更新 API 配置。
 *
 * - 如果提供新 apiKey，加密后更新
 * - 如果 isActive=true，先将用户其他配置设为非激活
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 验证配置属于当前用户
    const existing = await prisma.apiConfig.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "配置不存在" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = updateConfigSchema.safeParse(body);
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

    const { name, apiKey, model, baseUrl, isActive } = parseResult.data;

    // 如果设为激活，先取消其他激活配置
    if (isActive) {
      await prisma.apiConfig.updateMany({
        where: { userId: session.user.id, isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (apiKey !== undefined) updateData.apiKey = encrypt(apiKey);
    if (model !== undefined) updateData.model = model;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.apiConfig.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        provider: true,
        name: true,
        model: true,
        baseUrl: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("更新 API 配置失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}

/**
 * 删除 API 配置。
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 验证配置属于当前用户
    const existing = await prisma.apiConfig.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "配置不存在" } },
        { status: 404 }
      );
    }

    await prisma.apiConfig.delete({ where: { id } });

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("删除 API 配置失败:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } },
      { status: 500 }
    );
  }
}
