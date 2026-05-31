import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env before any IORedis client is created.
// In compiled CJS the require() calls below are hoisted, but the Redis/BullMQ
// constructors are lazy — this env block runs before any connection is opened.
try {
  const raw = readFileSync(join(__dirname, '../.env'), 'utf-8');
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/.exec(line.trim());
    if (m?.[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
} catch { /* .env is optional in production */ }

import { Worker } from 'bullmq';
import {
  getRedisConnection,
  createRedisClient,
  HEARTBEAT_KEY,
  HEARTBEAT_INTERVAL_MS,
  type CrawlJobData,
} from './queue';

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(`${new Date().toISOString()} [worker] ${msg}\n`);
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

const heartbeatRedis = createRedisClient();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

heartbeatRedis.on('connect', () => log('Heartbeat Redis connected'));
heartbeatRedis.on('error', (err: Error) => log(`Heartbeat Redis error: ${err.message}`));

async function beat(): Promise<void> {
  try {
    // TTL = 2× stale threshold so a transient Redis hiccup doesn't kill the key
    await heartbeatRedis.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', 120);
    log('Worker alive');
  } catch (err) {
    log(`Heartbeat write failed: ${String(err)}`);
  }
}

function startHeartbeat(): void {
  void beat();
  heartbeatTimer = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);
  log('Worker heartbeat started');
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────

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
      ...(maxPages !== undefined ? { maxPages } : {}),
      ...(selfAuditRunId !== undefined ? { selfAuditRunId } : {}),
    });
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
    // Audits run 3–8 minutes. Lock must outlast that or BullMQ marks them stalled.
    lockDuration: 600_000,    // 10 min lock
    stalledInterval: 30_000,  // check for stalled jobs every 30 s
    maxStalledCount: 1,       // one stall → one retry, then fail permanently
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
      .then(({ updateAuditStatus }) =>
        updateAuditStatus(auditId, 'failed', { errorMessage: msg }),
      )
      .catch((dbErr: unknown) => {
        log(`Could not write audit failure to DB: ${String(dbErr)}`);
      });
  }
});

worker.on('stalled', (jobId: string) => {
  log(`Job ${jobId} stalled — BullMQ will retry`);
});

worker.on('error', (err: Error) => {
  log(`Worker error: ${err.message}`);
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
  log(`${signal} received — draining active jobs and closing`);
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  try { await heartbeatRedis.del(HEARTBEAT_KEY); } catch { /* best effort */ }
  try { await heartbeatRedis.quit(); } catch { /* best effort */ }
  try { await worker.close(); } catch { /* best effort */ }
}

process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM').finally(() => process.exit(0)); });
process.on('SIGINT',  () => { void gracefulShutdown('SIGINT').finally(() => process.exit(0)); });

// ── Start ─────────────────────────────────────────────────────────────────────

startHeartbeat();
log(`BullMQ crawl worker started — Redis: ${(process.env['REDIS_URL'] ?? '').split('@').pop() ?? 'localhost:6379'}`);
