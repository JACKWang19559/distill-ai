/**
 * 蒸馏任务相关类型定义。
 */

import type { SourceType, DistillStatus, DistillResult, MediaMeta } from "./knowledge";

/** 蒸馏输入 */
export interface DistillInput {
  /** 来源类型 */
  sourceType: SourceType;
  /** 来源 URL（url/douyin/xiaohongshu 类型必填） */
  sourceUrl?: string;
  /** 文本内容（text/markdown 类型必填） */
  content?: string;
  /** 文件路径（pdf 类型必填） */
  filePath?: string;
  /** 是否使用 Hybrid 模式（PDF） */
  useHybrid?: boolean;
  /** Cookie（抖音/小红书反爬） */
  cookie?: string;
  /** 知识条目 ID（更新已有条目时使用） */
  knowledgeId?: string;
}

/** 蒸馏任务 */
export interface DistillTask {
  id: string;
  /** 用户 ID */
  userId: string;
  /** 状态 */
  status: DistillStatus;
  /** 知识条目 ID */
  knowledgeId?: string;
  /** 错误信息 */
  errorMessage?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 蒸馏任务响应 */
export interface DistillTaskResponse {
  id: string;
  status: DistillStatus;
  knowledgeId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/** 蒸馏结果响应 */
export interface DistillResultResponse {
  id: string;
  title: string;
  status: DistillStatus;
  distilledData: DistillResult;
  mediaMeta?: MediaMeta | null;
  sourceType: SourceType;
  sourceUrl?: string | null;
  createdAt: string;
}

/** 蒸馏进度阶段 */
export type DistillStage =
  | "queued"           // 排队中
  | "extracting"       // 提取内容中
  | "downloading"      // 下载视频中
  | "separating_audio" // 分离音频中
  | "transcribing"     // ASR 识别中
  | "distilling"       // AI 蒸馏中
  | "saving"           // 保存中
  | "completed"        // 已完成
  | "failed";          // 失败

/** 蒸馏进度事件（SSE 推送） */
export interface DistillProgressEvent {
  /** 任务 ID */
  taskId: string;
  /** 当前阶段 */
  stage: DistillStage;
  /** 进度百分比（0-100） */
  progress: number;
  /** 阶段描述 */
  message: string;
  /** 时间戳 */
  timestamp: string;
}
