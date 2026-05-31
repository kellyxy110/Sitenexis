import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const HEARTBEAT_KEY = 'worker:heartbeat';
export const HEARTBEAT_INTERVAL_MS = 15_000;  // write every 15 s
export const HEARTBEAT_STALE_MS    = 60_000;  // dead if > 60 s old

export interface CrawlJobData {
  auditId: string;
  domain: string;
  userId: string;
  maxPages?: number;
  layer4Enabled?: boolean;
  selfAuditRunId?: string;
}

function redisUrl(): string {
  return process.env['REDIS_URL'] ?? 'redis://localhost:6379';
}

/** Create a new IORedis client. Call this each time you need an independent connection. */
export function createRedisClient(): IORedis {
  const url = redisUrl();
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    reconnectOnError: () => true,
    enableOfflineQueue: true,
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  });
}

// ── Lazy singletons for BullMQ (Queue + Worker share the same connection) ──────

let _connection: IORedis | null = null;
let _queue: Queue<CrawlJobData> | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) _connection = createRedisClient();
  return _connection;
}

function getCrawlQueue(): Queue<CrawlJobData> {
  if (!_queue) {
    _queue = new Queue<CrawlJobData>('crawl', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

/**
 * Verify Redis is reachable with a hard 5-second timeout.
 * Uses a disposable connection with offline-queue disabled so it throws
 * immediately on ECONNREFUSED instead of waiting indefinitely.
 * Called before every enqueue so the API route fails fast with a clear error.
 */
async function pingRedis(): Promise<void> {
  const url = redisUrl();
  const client = new IORedis(url, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    retryStrategy: () => null, // no retries — fail immediately
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  });

  try {
    await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Redis ping timed out after 5 000ms — REDIS_URL: ${url.replace(/:[^@]+@/, ':***@')}`)), 5_000),
      ),
    ]);
  } finally {
    client.disconnect();
  }
}

export async function getCrawlQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const q = getCrawlQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

export async function enqueueCrawlJob(data: CrawlJobData): Promise<string> {
  // Fail fast: verify Redis is reachable before creating the Queue connection.
  // Without this, IORedis offline-queue causes the call to hang until Vercel timeout.
  await pingRedis();
  const job = await getCrawlQueue().add('crawl-domain', data, { jobId: data.auditId });
  return job.id ?? data.auditId;
}

// Proxy kept for backward compat — accessing any property triggers lazy creation.
export const redisConnection: IORedis = new Proxy({} as IORedis, {
  get(_target, prop) {
    return Reflect.get(getRedisConnection(), prop);
  },
});
