/**
 * Sliding-window rate limiter backed by Redis (when available) with an
 * in-process fallback for dev/single-instance environments.
 *
 * Usage:
 *   const result = await rateLimit('audit:start', ip, { limit: 10, windowSec: 60 });
 *   if (!result.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: result.headers });
 */

import { type NextResponse } from 'next/server';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset: number;             // Unix timestamp (seconds) when the window resets
  headers: Record<string, string>;
}

// ─── In-process fallback (single-instance / dev) ─────────────────────────────

interface WindowEntry { count: number; resetAt: number }
const memStore = new Map<string, WindowEntry>();

function memRateLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const entry = memStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowSec });
    const remaining = limit - 1;
    return {
      ok: true,
      remaining,
      reset: now + windowSec,
      headers: rateLimitHeaders(limit, remaining, now + windowSec),
    };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  return {
    ok: entry.count <= limit,
    remaining,
    reset: entry.resetAt,
    headers: rateLimitHeaders(limit, remaining, entry.resetAt),
  };
}

// ─── Redis-backed sliding window ──────────────────────────────────────────────

async function redisRateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult | null> {
  try {
    const { getRedisConnection } = await import('@sitenexis/crawler');
    const redis = getRedisConnection();

    const now = Math.floor(Date.now() / 1000);
    const windowKey = `rl:${key}:${Math.floor(now / windowSec)}`;
    const resetAt = (Math.floor(now / windowSec) + 1) * windowSec;

    const count = await redis.incr(windowKey);
    if (count === 1) await redis.expire(windowKey, windowSec + 5);

    const remaining = Math.max(0, limit - count);
    return {
      ok: count <= limit,
      remaining,
      reset: resetAt,
      headers: rateLimitHeaders(limit, remaining, resetAt),
    };
  } catch {
    return null;
  }
}

function rateLimitHeaders(limit: number, remaining: number, reset: number): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset':     String(reset),
    'Retry-After':           String(reset - Math.floor(Date.now() / 1000)),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function rateLimit(
  namespace: string,
  identifier: string,
  options: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const key = `${namespace}:${identifier}`;
  const { limit, windowSec } = options;

  const redisResult = await redisRateLimit(key, limit, windowSec);
  if (redisResult !== null) return redisResult;

  return memRateLimit(key, limit, windowSec);
}

/** Extract best-effort client IP from a Next.js request */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Apply rate-limit headers to an existing NextResponse */
export function applyRateLimitHeaders(res: NextResponse, result: RateLimitResult): NextResponse {
  for (const [k, v] of Object.entries(result.headers)) {
    res.headers.set(k, v);
  }
  return res;
}
