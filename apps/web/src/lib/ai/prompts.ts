/**
 * 蒸馏 Prompt 与 Zod Schema。
 *
 * - DISTILL_SYSTEM_PROMPT：系统提示词，定义蒸馏专家角色与输出规范
 * - buildDistillUserPrompt：用户提示词模板，注入标题与内容
 * - distillResultSchema：Zod 校验 schema，保证 LLM 输出结构合法
 */

import { z } from "zod";

/**
 * 蒸馏系统提示词。
 *
 * 定义 AI 角色、输出格式、字段约束。
 * 要求严格输出 JSON，不包含额外说明。
 */
export const DISTILL_SYSTEM_PROMPT = `你是一位专业的知识蒸馏专家。你的任务是将输入的内容蒸馏为结构化的知识卡片，帮助用户快速掌握核心要点。

输出要求（严格 JSON 格式，不要包含任何额外说明、不要使用 markdown 代码块）：
{
  "title": "提炼后的标题（不超过 30 字）",
  "summary": "200 字以内的核心摘要",
  "keyPoints": ["3-7 个关键要点，每个不超过 50 字"],
  "outline": "层级大纲，Markdown 格式，最多 3 级",
  "entities": [{"name": "实体名称", "type": "person|concept|organization|technology|location|event"}],
  "suggestedTags": ["3-5 个推荐标签（中文）"]
}

字段说明：
1. title: 从内容中提炼的精炼标题，不超过 30 字
2. summary: 核心摘要，200 字以内，涵盖主要内容与结论
3. keyPoints: 3-7 个关键要点列表，每个不超过 50 字，按重要性排序
4. outline: 层级大纲，使用 Markdown 列表格式（- / *），最多 3 级深度
5. entities: 核心实体列表，type 必须是以下之一：person（人物）、concept（概念）、organization（组织）、technology（技术）、location（地点）、event（事件）
6. suggestedTags: 3-5 个中文推荐标签，反映内容主题

注意：
- 严格输出 JSON，不要包含 \`\`\`json 代码块标记
- 所有字段必须存在，即使为空数组也要输出 []
- entities 字段最多 20 个`;

/**
 * 构建蒸馏用户提示词。
 *
 * @param title 内容标题
 * @param content 原始内容
 * @returns 用户消息内容
 */
export function buildDistillUserPrompt(title: string, content: string): string {
  return `请蒸馏以下内容：

标题：${title}

内容：
${content}

请按照系统提示的 JSON 格式输出蒸馏结果。`;
}

// ============================================================================
// Zod Schema 校验
// ============================================================================

/** 实体类型枚举 */
export const entityTypeSchema = z.enum([
  "person",
  "concept",
  "organization",
  "technology",
  "location",
  "event",
]);

/** 实体 schema */
export const entitySchema = z.object({
  name: z.string().min(1).max(100),
  type: entityTypeSchema,
});

/**
 * 蒸馏结果 schema。
 *
 * 用于校验 LLM 返回的 JSON 是否符合预期结构。
 * 校验失败时，调用方应尝试修复或报错。
 */
export const distillResultSchema = z.object({
  /** 提炼后的标题 */
  title: z.string().min(1).max(100),
  /** 核心摘要 */
  summary: z.string().min(1).max(500),
  /** 关键点列表 */
  keyPoints: z.array(z.string().min(1).max(100)).min(1).max(10),
  /** 大纲（Markdown） */
  outline: z.string(),
  /** 实体列表 */
  entities: z.array(entitySchema).max(20).default([]),
  /** 推荐标签 */
  suggestedTags: z.array(z.string().min(1).max(20)).min(0).max(10),
});

/** 蒸馏结果类型（从 Zod schema 推断） */
export type DistillOutput = z.infer<typeof distillResultSchema>;

/**
 * 从 LLM 响应中提取并校验蒸馏结果。
 *
 * 处理常见问题：
 * - 去除 markdown 代码块标记（```json ... ```）
 * - 去除首尾空白
 * - JSON 解析
 * - 容错截断：entities 超过 20 个时取前 20 个（AI 偶尔不遵守约束）
 * - Zod 校验
 *
 * @param raw LLM 返回的原始文本
 * @returns 校验后的蒸馏结果
 * @throws 如果解析或校验失败
 */
export function parseDistillResult(raw: string): DistillOutput {
  // 去除 markdown 代码块标记
  let cleaned = raw.trim();

  // 去除 ```json ... ``` 或 ``` ... ``` 包裹
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // 尝试找到第一个 { 和最后一个 }（处理 LLM 前后多余文本）
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`LLM 输出 JSON 解析失败: ${(err as Error).message}`);
  }

  // 容错截断：AI 偶尔会忽略 "entities 最多 20 个" 的约束
  // 在 Zod 校验前主动截断，避免整个蒸馏任务失败
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).entities)
  ) {
    const entities = (parsed as Record<string, unknown[]>).entities;
    if (entities.length > 20) {
      (parsed as Record<string, unknown[]>).entities = entities.slice(0, 20);
    }
  }

  const result = distillResultSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`蒸馏结果校验失败: ${issues}`);
  }

  return result.data;
}
