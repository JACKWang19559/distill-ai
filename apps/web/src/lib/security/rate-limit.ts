/**
 * 简易内存速率限制器。
 *
 * 基于 IP + 路径的滑动窗口计数器，防止暴力破解和滥用。
 * 生产环境建议替换为 Redis 实现（支持多实例共享）。
 *
 * 使用方式：
 * ```ts
 * const result = rateLimit(request, { windowMs: 60000, max: 5 });
 * if (!result.success) {
 *   return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
 * }
 * ```
 */

/** 速率限制配置 */
interface RateLimitOptions {
  /** 时间窗口（毫秒），默认 60000（1 分钟） */
  windowMs?: number;
  /** 窗口内最大请求数，默认 10 */
  max?: number;
  /** 自定义 key 前缀（如 "login"、"register"），默认用路径 */
  keyPrefix?: string;
}

/** 速率限制结果 */
interface RateLimitResult {
  /** 是否允许请求 */
  success: boolean;
  /** 窗口内剩余请求数 */
  remaining: number;
  /** 重置时间戳（毫秒） */
  resetAt: number;
}

/** 计数器条目 */
interface CounterEntry {
  count: number;
  resetAt: number;
}

/** 内存计数器（key → entry） */
const counters = new Map<string, CounterEntry>();

/** 定期清理过期条目（每 5 分钟） */
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

/**
 * 清理过期的计数器条目。
 */
function cleanupExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) {
      counters.delete(key);
    }
  }
}

/**
 * 从请求中提取客户端 IP。
 *
 * 优先使用 x-forwarded-for（代理场景），其次 x-real-ip。
 *
 * @param request - Next.js Request 对象
 * @returns 客户端 IP 地址
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

/**
 * 速率限制检查。
 *
 * 基于 IP + keyPrefix 的滑动窗口计数器。
 * 如果超过限制，返回 success: false。
 *
 * @param request - Next.js Request 对象
 * @param options - 速率限制配置
 * @returns 速率限制结果
 */
export function rateLimit(
  request: Request,
  options: RateLimitOptions = {}
): RateLimitResult {
  const {
    windowMs = 60000,
    max = 10,
    keyPrefix = new URL(request.url).pathname,
  } = options;

  cleanupExpired();

  const ip = getClientIp(request);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  const entry = counters.get(key);

  // 无记录或窗口已过期，重置计数器
  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt });
    return { success: true, remaining: max - 1, resetAt };
  }

  // 未超限，递增计数
  if (entry.count < max) {
    entry.count += 1;
    return { success: true, remaining: max - entry.count, resetAt: entry.resetAt };
  }

  // 超限
  return { success: false, remaining: 0, resetAt: entry.resetAt };
}

/**
 * 创建 429 Too Many Requests 响应。
 *
 * @param resetAt - 重置时间戳
 * @returns NextResponse 429
 */
export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后再试" },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(retryAfter, 1)),
      },
    }
  );
}
