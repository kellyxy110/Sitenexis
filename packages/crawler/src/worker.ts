// ── Env bootstrap ─────────────────────────────────────────────────────────────
// Load .env BEFORE any imports that reference process.env (IORedis, BullMQ).
// On Railway / Vercel the file won't exist and the catch is silently swallowed.
import { readFileSync } from 'fs';
import { join }         from 'path';

try {
  const raw = readFileSync(join(__dirname, '../.env'), 'utf-8');
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/.exec(line.trim());
    if (m?.[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
} catch { /* .env is optional — env vars are injected by Railway/Vercel in production */ }

import { Worker }   from 'bullmq';
import {
  validateRedisUrl,
  maskUrl,
  getRedisUrl,
  createRedisClient,
  HEARTBEAT_KEY,
  HEARTBEAT_INTERVAL_MS,
  type CrawlJobData,
} from './queue';

// ── Startup validation ────────────────────────────────────────────────────────
// Exits immediately with a clear message if REDIS_URL is missing or localhost.
validateRedisUrl();

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(`${new Date().toISOString()} [worker] ${msg}\n`);
}

// ── Heartbeat Redis client ────────────────────────────────────────────────────
// Separate connection from BullMQ's connection (BullMQ requirement).
// Uses a standard (non-BullMQ) client — maxRetriesPerRequest: 3 is fine here.

const heartbeatRedis = createRedisClient(false);
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastHeartbeatErrorLog = 0;

heartbeatRedis.on('connect', () => log('Heartbeat Redis connected'));
heartbeatRedis.on('ready',   () => log('Heartbeat Redis ready'));

// Rate-limit error logs: emit at most once every 30 s to avoid flooding.
heartbeatRedis.on('error', (err: Error) => {
  const now = Date.now();
  if (now - lastHeartbeatErrorLog > 30_000) {
    log(`Heartbeat Redis error: ${err.message}`);
    lastHeartbeatErrorLog = now;
  }
});

heartbeatRedis.on('reconnecting', () => log('Heartbeat Redis reconnecting…'));
heartbeatRedis.on('close',        () => log('Heartbeat Redis connection closed'));

async function beat(): Promise<void> {
  try {
    // TTL = 2× stale threshold so a brief Redis hiccup doesn't evict the key.
    await heartbeatRedis.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', 120);
  } catch {
    // Failure is already visible via the 'error' event — no need to double-log.
  }
}

function startHeartbeat(): void {
  void beat();
  heartbeatTimer = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);
  log('Heartbeat started');
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────
// BullMQ requires its own dedicated connection with maxRetriesPerRequest: null.

const bullMqConnection = createRedisClient(true);
let lastWorkerErrorLog = 0;

bullMqConnection.on('connect',     () => log('BullMQ Redis connected'));
bullMqConnection.on('ready',       () => log('BullMQ Redis ready'));
bullMqConnection.on('reconnecting',() => log('BullMQ Redis reconnecting…'));
bullMqConnection.on('error', (err: Error) => {
  const now = Date.now();
  if (now - lastWorkerErrorLog > 30_000) {
    log(`BullMQ Redis error: ${err.message}`);
    lastWorkerErrorLog = now;
  }
});

const worker = new Worker<CrawlJobData>(
  'crawl',
  async (job) => {
    const { auditId, domain, userId, layer4Enabled = false, maxPages, selfAuditRunId } = job.data;
    log(`Job ${job.id} started — audit:${auditId} domain:${domain}${selfAuditRunId ? ' (self-audit)' : ''}`);

    const { runInfrastructureAgent } = await import('@sitenexis/agents');
    await runInfrastructureAgent({
      auditId,
      domain,
      userId,
      layer4Enabled,
      ...(maxPages       !== undefined ? { maxPages }       : {}),
      ...(selfAuditRunId !== undefined ? { selfAuditRunId } : {}),
    });
  },
  {
    connection:        bullMqConnection,
    concurrency:       5,
    lockDuration:      600_000,   // 10 min — audits can take 3–8 min
    stalledInterval:   30_000,    // check for stalled jobs every 30 s
    maxStalledCount:   1,         // one stall → retry, then fail permanently
  },
);

worker.on('completed', (job) => {
  log(`Job ${job.id} completed — audit:${job.data.auditId}`);
});

worker.on('failed', (job, err) => {
  const msg = err instanceof Error ? err.message : String(err);
  log(`Job ${job?.id} permanently failed: ${msg}`);

  const auditId = job?.data?.auditId;
  if (auditId) {
    import('@sitenexis/db')
      .then(({ updateAuditStatus }) => updateAuditStatus(auditId, 'failed', { errorMessage: msg }))
      .catch((dbErr: unknown) => {
        log(`Could not write audit failure to DB: ${String(dbErr)}`);
      });
  }
});

worker.on('stalled', (jobId: string) => {
  log(`Job ${jobId} stalled — BullMQ will retry`);
});

worker.on('error', (err: Error) => {
  // BullMQ emits 'error' for connection issues — already logged at the IORedis level.
  // Only log here if it carries different information.
  if (!err.message.includes('connect') && !err.message.includes('ECONNREFUSED')) {
    log(`Worker error: ${err.message}`);
  }
});

// ── Crash protection ──────────────────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  log(`Uncaught exception: ${err.message}\n${err.stack ?? ''}`);
  void gracefulShutdown('uncaughtException').finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason: unknown) => {
  log(`Unhandled rejection: ${String(reason)}`);
  void gracefulShutdown('unhandledRejection').finally(() => process.exit(1));
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  log(`${signal} received — draining active jobs`);
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  try { await heartbeatRedis.del(HEARTBEAT_KEY); } catch { /* best effort */ }
  try { await heartbeatRedis.quit();             } catch { /* best effort */ }
  try { await worker.close();                    } catch { /* best effort */ }
  try { await bullMqConnection.quit();           } catch { /* best effort */ }
}

process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM').finally(() => process.exit(0)); });
process.on('SIGINT',  () => { void gracefulShutdown('SIGINT').finally(() => process.exit(0)); });

// ── Start ─────────────────────────────────────────────────────────────────────

startHeartbeat();
log(`BullMQ worker started`);
log(`Redis: ${maskUrl(getRedisUrl())}`);
log(`TLS: ${getRedisUrl().startsWith('rediss://') ? 'enabled' : 'disabled'}`);
