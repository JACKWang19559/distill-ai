/**
 * PDF 分块蒸馏模块。
 *
 * 当 PDF 解析出的 Markdown 内容过长时，
 * 分块调用 AI 蒸馏，最后合并结果。
 */

import type { AIProvider } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/ai/types";
import {
  DISTILL_SYSTEM_PROMPT,
  buildDistillUserPrompt,
  parseDistillResult,
} from "@/lib/ai/prompts";
import type { DistillOutput } from "@/lib/ai/prompts";
import { PDF_CHUNK_MAX_CHARS } from "@/lib/config";

/**
 * 将长文本按段落边界分块。
 *
 * 尽量在段落边界（\n\n）处切分，避免截断段落。
 *
 * @param text 原始文本
 * @param maxChars 单块最大字符数
 * @returns 分块数组
 */
function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  // 按段落分割
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    // 若当前块 + 新段落超限，且当前块非空，先保存当前块
    if (currentChunk.length + paragraph.length + 2 > maxChars && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    // 若单个段落超过 maxChars，硬切分
    if (paragraph.length > maxChars) {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
    } else {
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * 蒸馏单个分块。
 *
 * @param provider AI 供应商
 * @param chunkContent 分块内容
 * @returns 蒸馏结果
 */
async function distillChunk(
  provider: AIProvider,
  chunkContent: string
): Promise<DistillOutput> {
  const messages: ChatMessage[] = [
    { role: "system", content: DISTILL_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildDistillUserPrompt("PDF 文档分块", chunkContent),
    },
  ];

  const response = await provider.chat(messages, {
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: "json",
    timeoutMs: 120_000,
  });

  return parseDistillResult(response.content);
}

/**
 * 合并多个分块的蒸馏结果。
 *
 * 合并策略：
 * - title: 取第一块的标题
 * - summary: 拼接各块 summary
 * - keyPoints: 合并去重，取前 7 个
 * - outline: 拼接各块 outline
 * - suggestedTags: 合并去重，取前 5 个
 * - entities: 合并去重，取前 20 个（Zod schema 上限）
 *
 * @param results 各分块的蒸馏结果
 * @returns 合并后的蒸馏结果
 */
function mergeDistillResults(results: DistillOutput[]): DistillOutput {
  if (results.length === 0) {
    return {
      title: "PDF 文档",
      summary: "",
      keyPoints: [],
      outline: "",
      entities: [],
      suggestedTags: [],
    };
  }

  const first = results[0];

  // 合并 keyPoints（去重）
  const allKeyPoints = results.flatMap((r) => r.keyPoints);
  const uniqueKeyPoints = [...new Set(allKeyPoints)].slice(0, 7);

  // 合并 suggestedTags（去重）
  const allTags = results.flatMap((r) => r.suggestedTags);
  const uniqueTags = [...new Set(allTags)].slice(0, 5);

  // 合并 entities（按 name 去重，取前 20 个以符合 Zod schema 上限）
  type DistillEntity = DistillOutput["entities"][number];
  const entityMap = new Map<string, DistillEntity>();
  for (const r of results) {
    if (r.entities) {
      for (const e of r.entities) {
        if (!entityMap.has(e.name)) {
          entityMap.set(e.name, e);
        }
      }
    }
  }
  // 截断到 20 个，避免合并后超限
  const mergedEntities = Array.from(entityMap.values()).slice(0, 20);

  return {
    title: first.title,
    summary: results.map((r) => r.summary).join("\n\n"),
    keyPoints: uniqueKeyPoints,
    outline: results.map((r) => r.outline).join("\n\n---\n\n"),
    suggestedTags: uniqueTags,
    entities: mergedEntities,
  };
}

/**
 * 分块蒸馏 PDF 内容。
 *
 * 若内容不超过 PDF_CHUNK_MAX_CHARS，直接单次蒸馏。
 * 否则分块蒸馏后合并结果。
 *
 * @param markdown PDF 解析出的 Markdown 内容
 * @param provider AI 供应商
 * @returns 蒸馏结果
 */
export async function distillPdfInChunks(
  markdown: string,
  provider: AIProvider
): Promise<DistillOutput> {
  // 内容不长，直接单次蒸馏
  if (markdown.length <= PDF_CHUNK_MAX_CHARS) {
    return distillChunk(provider, markdown);
  }

  // 分块蒸馏
  const chunks = splitIntoChunks(markdown, PDF_CHUNK_MAX_CHARS);
  console.log(`[PDF 分块蒸馏] 内容 ${markdown.length} 字符，分为 ${chunks.length} 块`);

  const results: DistillOutput[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[PDF 分块蒸馏] 正在蒸馏第 ${i + 1}/${chunks.length} 块...`);
    const result = await distillChunk(provider, chunks[i]);
    results.push(result);
  }

  return mergeDistillResults(results);
}
