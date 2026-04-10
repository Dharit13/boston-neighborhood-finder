import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        analytics: false,
        prefix: "bnh:ai",
      })
    : null;

let warnedOnce = false;
function warnOnce() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiter disabled."
  );
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!limiter) {
    warnOnce();
    return { ok: true, remaining: Number.POSITIVE_INFINITY, resetSeconds: 0 };
  }
  const { success, remaining, reset } = await limiter.limit(`ip:${ip}`);
  return {
    ok: success,
    remaining,
    resetSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
  };
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
