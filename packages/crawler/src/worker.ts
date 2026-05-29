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
  process.stderr.write(`[worker] Job ${job?.id} failed: ${String(err)}\n`);
});

worker.on('completed', (job) => {
  process.stderr.write(`[worker] Job ${job.id} completed\n`);
});

process.stderr.write(`[worker] BullMQ crawl worker started — Redis: ${process.env['REDIS_URL'] ?? 'localhost:6379'}\n`);
