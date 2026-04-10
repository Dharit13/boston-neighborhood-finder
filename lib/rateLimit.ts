import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(20, "1 h"),
        analytics: false,
        prefix: "ai-user-20-1h",
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
  remaining?: number;
  resetAt?: number;
}

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    warnOnce();
    return { ok: true };
  }
  const { success, remaining, reset } = await ratelimit.limit(identifier);
  if (!success) {
    return { ok: false, remaining, resetAt: reset };
  }
  return { ok: true, remaining };
}

export function ipFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
