/**
 * API 通用类型定义。
 */

/** 统一 API 响应结构 */
export interface ApiResponse<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** 分页响应 */
export interface PaginatedResponse<T = unknown> {
  /** 数据列表 */
  data: T[];
  /** 分页信息 */
  pagination: {
    /** 当前页码（从 1 开始） */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 总数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

/** 分页查询参数 */
export interface PaginationParams {
  /** 页码（从 1 开始） */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/** 知识库查询过滤参数 */
export interface KnowledgeFilterParams extends PaginationParams {
  /** 搜索关键词 */
  q?: string;
  /** 标签 ID 列表 */
  tagIds?: string[];
  /** 来源类型列表 */
  sourceTypes?: string[];
  /** 开始时间（ISO 字符串） */
  startDate?: string;
  /** 结束时间（ISO 字符串） */
  endDate?: string;
  /** 排序字段 */
  sortBy?: "createdAt" | "updatedAt" | "title";
  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}

/** AI 供应商类型 */
export type AIProviderType =
  | "openai"
  | "anthropic"
  | "qwen"
  | "deepseek"
  | "zhipu";

/** API 配置 */
export interface ApiConfig {
  id: string;
  /** 用户 ID */
  userId: string;
  /** 供应商类型 */
  provider: AIProviderType;
  /** 显示名称 */
  name: string;
  /** API Key（加密存储） */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** API 地址（可选，自定义代理） */
  baseUrl?: string;
  /** 是否激活 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/** 创建 API 配置请求 */
export interface CreateApiConfigInput {
  provider: AIProviderType;
  name: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** 更新 API 配置请求 */
export interface UpdateApiConfigInput {
  name?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  isActive?: boolean;
}

/** ASR 供应商类型 */
export type ASRProviderType = "whisper-local" | "cloud";

/** 云端 ASR 供应商 */
export type CloudASRProvider = "tongyi" | "xunfei" | "openai";
