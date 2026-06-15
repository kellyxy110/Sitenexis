/**
 * Redis-backed sliding-window rate limiter with in-process fallback.
 * Redis path uses the REDIS_URL env var directly (no @sitenexis/crawler dependency).
 * Falls back to in-process Map on Redis unavailability — adequate for single-instance
 * dev but not guaranteed across Vercel function instances in production.
 */

interface Entry { count: number; resetAt: number }
const memStore = new Map<string, Entry>();

function memRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memStore.entries()) {
    if (v.resetAt < now) memStore.delete(k);
  }
}, 5 * 60 * 1000);

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<boolean | null> {
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl || redisUrl === 'redis://localhost:6379') return null;

  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 1500, enableReadyCheck: false });
    await redis.connect().catch(() => null);

    const windowKey = `adnexis:rl:${key}:${Math.floor(Date.now() / windowMs)}`;
    const count = await redis.incr(windowKey);
    if (count === 1) await redis.pexpire(windowKey, windowMs + 5000);

    await redis.quit().catch(() => null);
    return count <= limit;
  } catch {
    return null;
  }
}

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * key      — unique bucket identifier (e.g. `analyze:${userId}`)
 * limit    — max requests allowed in the window
 * windowMs — window duration in milliseconds
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redisResult = await redisRateLimit(key, limit, windowMs);
  if (redisResult !== null) return redisResult;
  return memRateLimit(key, limit, windowMs);
}
