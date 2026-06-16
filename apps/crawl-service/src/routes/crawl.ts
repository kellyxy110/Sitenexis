import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createJob } from '../lib/job-store.js';
import { runCrawlBridge } from '../lib/crawler-bridge.js';

const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1)/i;

/**
 * POST /crawl
 * Body: { domain: string; maxPages?: number }
 * Returns: { jobId: string; streamUrl: string }
 *
 * Starts a crawl job asynchronously. Poll progress via GET /crawl/:jobId/events.
 */
export async function handleStartCrawl(req: Request, res: Response): Promise<void> {
  const { domain, maxPages = 100 } = req.body as {
    domain?: unknown;
    maxPages?: unknown;
  };

  if (typeof domain !== 'string' || !DOMAIN_RE.test(domain.trim())) {
    res.status(400).json({ error: 'Invalid domain format' });
    return;
  }

  if (PRIVATE_IP_RE.test(domain)) {
    res.status(400).json({ error: 'Private or reserved domains are not allowed' });
    return;
  }

  const safeMaxPages = Math.min(
    500,
    Math.max(1, typeof maxPages === 'number' ? Math.floor(maxPages) : 100),
  );

  const jobId = uuidv4();
  createJob(jobId, domain.trim().toLowerCase(), safeMaxPages);

  // Start crawl fire-and-forget — SSE stream delivers progress
  runCrawlBridge(jobId, domain.trim().toLowerCase(), {
    maxPages: safeMaxPages,
  }).catch(() => {
    // Errors are handled inside the bridge and emitted as SSE 'failed' events
  });

  res.status(202).json({
    jobId,
    domain: domain.trim().toLowerCase(),
    streamUrl: `/crawl/${jobId}/events`,
  });
}

/**
 * GET /crawl/:jobId
 * Returns current job status snapshot (non-streaming).
 */
export async function handleGetJob(req: Request, res: Response): Promise<void> {
  const { getJob } = await import('../lib/job-store.js');
  const job = getJob(req.params['jobId'] ?? '');

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    jobId:           job.id,
    domain:          job.domain,
    status:          job.status,
    pagesProcessed:  job.pagesProcessed,
    pagesDiscovered: job.pagesDiscovered,
    createdAt:       job.createdAt,
    startedAt:       job.startedAt,
    completedAt:     job.completedAt,
    error:           job.error,
  });
}
