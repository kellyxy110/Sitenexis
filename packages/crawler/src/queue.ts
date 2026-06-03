import { Queue } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';

export const HEARTBEAT_KEY        = 'worker:heartbeat';
export const HEARTBEAT_INTERVAL_MS = 15_000;  // write every 15 s
export const HEARTBEAT_STALE_MS    = 60_000;  // dead if > 60 s old

export interface CrawlJobData {
  auditId:        string;
  domain:         string;
  userId:         string;
  maxPages?:      number;
  layer4Enabled?: boolean;
  selfAuditRunId?: string;
}

// ── Env validation ────────────────────────────────────────────────────────────

export function getRedisUrl(): string {
  return process.env['REDIS_URL'] ?? '';
}

/**
 * Call once at process startup. Prints the masked URL and exits with a clear
 * message if REDIS_URL is missing or still points to localhost (which never
 * works on Railway / Vercel).
 */
export function validateRedisUrl(): void {
  const url = getRedisUrl();

  if (!url) {
    process.stderr.write(
      `[redis] FATAL: REDIS_URL environment variable is not set.\n` +
      `[redis] Set it to your Upstash URL: rediss://default:<token>@<host>.upstash.io:6379\n`,
    );
    process.exit(1);
  }

  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    process.stderr.write(
      `[redis] FATAL: REDIS_URL points to localhost (${maskUrl(url)}).\n` +
      `[redis] This never works on Railway or Vercel. Set REDIS_URL to your Upstash URL.\n`,
    );
    process.exit(1);
  }

  process.stderr.write(`[redis] REDIS_URL validated: ${maskUrl(url)}\n`);
}

/** Replace password segment with *** for safe logging. */
export function maskUrl(url: string): string {
  return url.replace(/:([^@]+)@/, ':***@');
}

// ── IORedis factory ───────────────────────────────────────────────────────────

/** Options shared by every IORedis client in this process. */
function sharedOptions(isBullMq = false): RedisOptions {
  const url     = getRedisUrl();
  const isTls   = url.startsWith('rediss://');

  return {
    // BullMQ requires null — regular clients benefit from a limit so they don't
    // block forever on a dead connection.
    maxRetriesPerRequest: isBullMq ? null : 3,

    // Exponential backoff capped at 10 s. Returning null stops retries (used
    // in the fast-probe client only).
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 500, 10_000);
      // Only log every 5th attempt so logs don't flood on a brief outage.
      if (times % 5 === 1) {
        process.stderr.write(
          `[redis] Reconnecting (attempt ${times}) — next in ${delay}ms\n`,
        );
      }
      return delay;
    },

    reconnectOnError: () => true,
    enableOfflineQueue: true,
    connectTimeout: 10_000,

    // TLS: Upstash requires explicit tls config for rediss:// URLs.
    // rejectUnauthorized: false is required on some Railway / Nixpack environments
    // where the system CA bundle doesn't include Let's Encrypt roots.
    ...(isTls
      ? {
          tls: {
            rejectUnauthorized: false,
            // Pass the host explicitly so SNI works correctly.
            servername: new URL(url).hostname,
          },
        }
      : {}),
  };
}

/**
 * Create a fresh IORedis connection.
 * Every caller gets its own connection — do NOT share BullMQ connections
 * across Queue and Worker instances (BullMQ requirement).
 */
export function createRedisClient(isBullMq = false): IORedis {
  const url = getRedisUrl();
  if (!url) throw new Error('REDIS_URL is not set — call validateRedisUrl() at startup');
  return new IORedis(url, sharedOptions(isBullMq));
}

// ── Queue singleton (used by API routes to enqueue jobs) ──────────────────────

let _queueConn: IORedis | null = null;
let _queue: Queue<CrawlJobData> | null = null;

function getQueueConnection(): IORedis {
  if (!_queueConn) _queueConn = createRedisClient(true);
  return _queueConn;
}

function getCrawlQueue(): Queue<CrawlJobData> {
  if (!_queue) {
    _queue = new Queue<CrawlJobData>('crawl', {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    });
  }
  return _queue;
}

/**
 * Lightweight connectivity probe — new disposable client, 5 s timeout,
 * zero retries. Throws on failure. Used by the API route before enqueue.
 */
async function probeRedis(): Promise<void> {
  const url = getRedisUrl();
  const isTls = url.startsWith('rediss://');

  const client = new IORedis(url, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    retryStrategy: () => null,
    ...(isTls
      ? { tls: { rejectUnauthorized: false, servername: new URL(url).hostname } }
      : {}),
  });

  try {
    await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Redis ping timed out — URL: ${maskUrl(url)}`)),
          5_000,
        ),
      ),
    ]);
  } finally {
    client.disconnect();
  }
}

export async function getCrawlQueueStats(): Promise<{
  waiting: number; active: number; completed: number; failed: number;
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
  await probeRedis();
  const job = await getCrawlQueue().add('crawl-domain', data, { jobId: data.auditId });
  return job.id ?? data.auditId;
}

/**
 * Shared connection singleton — kept for backward compatibility with the
 * health route and any code that calls getRedisConnection().
 * Uses a regular (non-BullMQ) connection.
 */
let _sharedConn: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_sharedConn) _sharedConn = createRedisClient(false);
  return _sharedConn;
}

// Legacy proxy — accessing any property delegates to the lazy singleton.
export const redisConnection: IORedis = new Proxy({} as IORedis, {
  get(_target, prop) {
    return Reflect.get(getRedisConnection(), prop);
  },
});
