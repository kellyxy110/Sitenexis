import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export interface CrawlJobData {
  auditId: string;
  domain: string;
  userId: string;
  maxPages?: number;
  layer4Enabled?: boolean;
}

function buildRedisConnection(): IORedis {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  });
}

// Lazy singletons — not created at import time so that env vars loaded in
// worker.ts (or by Next.js) are available when the connection is first used.
let _connection: IORedis | null = null;
let _queue: Queue<CrawlJobData> | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) _connection = buildRedisConnection();
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

export async function enqueueCrawlJob(data: CrawlJobData): Promise<string> {
  const job = await getCrawlQueue().add('crawl-domain', data, { jobId: data.auditId });
  return job.id ?? data.auditId;
}

// Kept for backward compat with any code that spreads the connection into BullMQ options.
// Accessing this property triggers lazy creation, so it's safe after env loading.
export const redisConnection: IORedis = new Proxy({} as IORedis, {
  get(_target, prop) {
    return Reflect.get(getRedisConnection(), prop);
  },
});
