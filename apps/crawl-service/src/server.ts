import express from 'express';
import cors from 'cors';
import { handleStartCrawl, handleGetJob } from './routes/crawl.js';
import { handleStreamEvents } from './routes/stream.js';
import { evictExpiredJobs } from './lib/job-store.js';

export function createServer(): express.Application {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? '*',
    methods: ['GET', 'POST'],
  }));

  // ── Routes ───────────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sitenexis-crawl-service', ts: new Date().toISOString() });
  });

  app.post('/crawl',                       handleStartCrawl);
  app.get('/crawl/:jobId',                 handleGetJob);
  app.get('/crawl/:jobId/events',          handleStreamEvents);

  // ── 404 handler ──────────────────────────────────────────────────────────────

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Error handler ─────────────────────────────────────────────────────────────

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  });

  return app;
}

// Evict stale jobs every 10 minutes
setInterval(evictExpiredJobs, 10 * 60 * 1000);
