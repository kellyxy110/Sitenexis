import type { Request, Response } from 'express';
import { getJob } from '../lib/job-store.js';
import { subscribe, emit } from '../lib/sse.js';

/**
 * GET /crawl/:jobId/events
 * SSE stream — emits CrawlEvent objects as the crawl progresses.
 * If the job has already completed, immediately sends a 'completed' event and closes.
 */
export function handleStreamEvents(req: Request, res: Response): void {
  const jobId = req.params['jobId'] ?? '';
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Register the client as an SSE subscriber
  subscribe(jobId, res);

  // If the job already finished before this client connected, replay terminal event
  if (job.status === 'completed') {
    emit(jobId, {
      type:       'completed',
      jobId,
      pagesCount: job.pagesProcessed,
      durationMs: job.completedAt
        ? job.completedAt.getTime() - (job.startedAt?.getTime() ?? job.createdAt.getTime())
        : 0,
      timestamp:  (job.completedAt ?? new Date()).toISOString(),
    });
    res.end();
    return;
  }

  if (job.status === 'failed') {
    emit(jobId, {
      type:      'failed',
      jobId,
      error:     job.error ?? 'Unknown error',
      timestamp: (job.completedAt ?? new Date()).toISOString(),
    });
    res.end();
    return;
  }

  // Client is now live — the crawl bridge will push events via emit()
}
