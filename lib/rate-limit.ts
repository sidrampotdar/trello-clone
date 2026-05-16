import "server-only";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

declare global {
  var _rateBuckets: Map<string, Bucket> | undefined;
}

if (!global._rateBuckets) global._rateBuckets = new Map();

const BUCKETS = global._rateBuckets;

export interface RateLimitConfig {
  capacity: number;
  refillPerSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export function rateLimit(key: string, cfg: RateLimitConfig, cost = 1): RateLimitResult {
  const now = Date.now();
  const b = BUCKETS.get(key) ?? { tokens: cfg.capacity, updatedAt: now };
  const elapsedSec = (now - b.updatedAt) / 1000;
  const refilled = Math.min(cfg.capacity, b.tokens + elapsedSec * cfg.refillPerSec);
  if (refilled < cost) {
    BUCKETS.set(key, { tokens: refilled, updatedAt: now });
    const need = cost - refilled;
    return { ok: false, remaining: Math.floor(refilled), retryAfter: Math.ceil(need / cfg.refillPerSec) };
  }
  const next = refilled - cost;
  BUCKETS.set(key, { tokens: next, updatedAt: now });
  return { ok: true, remaining: Math.floor(next), retryAfter: 0 };
}

export function clientKey(req: Request, prefix: string) {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  return `${prefix}:${ip}`;
}
