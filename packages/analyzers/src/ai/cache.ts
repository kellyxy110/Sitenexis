import { createHash } from 'crypto';
import IORedis from 'ioredis';

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

let _redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  }
  return _redis;
}

export function buildCacheKey(url: string, bodyText: string): string {
  return createHash('sha256').update(`${url}:${bodyText}`).digest('hex');
}

export async function getCachedScore<T>(key: string): Promise<T | null> {
  try {
    const cached = await getRedis().get(`ai-score:${key}`);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Cache miss is acceptable
  }
  return null;
}

export async function setCachedScore<T>(key: string, value: T): Promise<void> {
  try {
    await getRedis().setex(`ai-score:${key}`, TTL_SECONDS, JSON.stringify(value));
  } catch {
    // Cache write failure is non-fatal
  }
}
