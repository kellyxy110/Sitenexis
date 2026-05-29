import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env before any IORedis client is created.
// In compiled CJS output all require() calls are hoisted, but the IORedis
// constructor in queue.ts is now lazy (called inside getRedisConnection()),
// so this env block runs first and sets REDIS_URL before the first connection.
try {
  const raw = readFileSync(join(__dirname, '../.env'), 'utf-8');
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/.exec(line.trim());
    if (m?.[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
} catch { /* .env is optional in production */ }

import { Worker } from 'bullmq';
import { getRedisConnection, type CrawlJobData } from './queue';

const worker = new Worker<CrawlJobData>(
  'crawl',
  async (job) => {
    const { auditId, domain, userId, layer4Enabled = false, maxPages } = job.data;

    const { runInfrastructureAgent } = await import('@sitenexis/agents');

    await runInfrastructureAgent({
      auditId,
      domain,
      userId,
      layer4Enabled,
      ...(maxPages !== undefined ? { maxPages } : {}),
    });
  },
  {
    connection: getRedisConnection(), // lazy — called after env block above
    concurrency: 5,
  }
);

worker.on('failed', (job, err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[worker] Job ${job?.id} permanently failed: ${msg}\n`);

  // Safety net: if the infrastructure agent's catch block itself threw (e.g. DB briefly
  // unreachable), the audit row will be stuck at "running". Attempt a last-resort update
  // here so the UI doesn't spin forever. The upsert is idempotent — safe to duplicate.
  const auditId = job?.data?.auditId;
  if (auditId) {
    import('@sitenexis/db')
      .then(({ updateAuditStatus }) => updateAuditStatus(auditId, 'failed', { errorMessage: msg }))
      .catch((dbErr: unknown) => {
        process.stderr.write(`[worker] Could not write audit failure to DB: ${String(dbErr)}\n`);
      });
  }
});

worker.on('completed', (job) => {
  process.stderr.write(`[worker] Job ${job.id} completed\n`);
});

// Graceful shutdown — let the active job batch finish before the process exits.
// Without this, Kubernetes / PM2 SIGTERM kills the process mid-audit and active
// jobs stall for 30 s before BullMQ reschedules them.
const gracefulShutdown = async (signal: string): Promise<void> => {
  process.stderr.write(`[worker] ${signal} received — draining active jobs and closing\n`);
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('SIGINT',  () => { void gracefulShutdown('SIGINT'); });

process.stderr.write(`[worker] BullMQ crawl worker started — Redis: ${process.env['REDIS_URL'] ?? 'localhost:6379'}\n`);
