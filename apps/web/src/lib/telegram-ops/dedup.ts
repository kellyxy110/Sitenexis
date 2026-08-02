import { logger } from '@/lib/logger';

const KEY_PREFIX = 'ops-alert-dedup:';

/**
 * Returns true when this exact dedupeKey was already seen within its window
 * (i.e. this notification should be suppressed as a duplicate), false when
 * it's new and should be sent. Uses Redis SET NX EX as an atomic
 * check-and-mark — no separate GET+SET race.
 *
 * If Redis itself is unavailable, this fails OPEN (never suppresses) — for an
 * ops-alerting tool, duplicate noise on a Redis outage is a far smaller
 * problem than silently dropping a real incident alert.
 */
export async function shouldSuppressDuplicate(dedupeKey: string, windowSeconds: number): Promise<boolean> {
  try {
    const { createRedisClient } = await import('@sitenexis/crawler');
    const client = createRedisClient();
    try {
      const result = await client.set(`${KEY_PREFIX}${dedupeKey}`, '1', 'EX', windowSeconds, 'NX');
      // 'OK' means the key was newly set (not a duplicate); null means it already existed.
      return result !== 'OK';
    } finally {
      client.disconnect();
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Ops-alert dedup check failed — Redis unavailable, notifying without dedup');
    return false;
  }
}
