import { logger } from '@/lib/logger';

const LOG_KEY = 'ops-deployment-log';
const MAX_ENTRIES = 10;

export interface DeploymentLogEntry {
  state: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED';
  url: string | null;
  recordedAt: string; // ISO timestamp
}

/**
 * Deployment history has no Postgres table — adding one is a schema change
 * outside this feature's scope. A capped Redis list (LPUSH + LTRIM) gives the
 * /deployments command real recent history without a migration.
 */
export async function recordDeploymentEvent(entry: DeploymentLogEntry): Promise<void> {
  try {
    const { createRedisClient } = await import('@sitenexis/crawler');
    const client = createRedisClient();
    try {
      await client.lpush(LOG_KEY, JSON.stringify(entry));
      await client.ltrim(LOG_KEY, 0, MAX_ENTRIES - 1);
    } finally {
      client.disconnect();
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Failed to record deployment event — Redis unavailable');
  }
}

export async function getRecentDeploymentEvents(limit = 5): Promise<DeploymentLogEntry[]> {
  try {
    const { createRedisClient } = await import('@sitenexis/crawler');
    const client = createRedisClient();
    try {
      const raw = await client.lrange(LOG_KEY, 0, limit - 1);
      return raw
        .map((r) => {
          try {
            return JSON.parse(r) as DeploymentLogEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is DeploymentLogEntry => e !== null);
    } finally {
      client.disconnect();
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Failed to read deployment log — Redis unavailable');
    return [];
  }
}
