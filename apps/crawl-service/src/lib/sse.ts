import type { Response } from 'express';
import type { CrawlEvent } from '@sitenexis/shared';

/**
 * Registry of active SSE connections keyed by jobId.
 * Multiple clients can subscribe to the same job stream.
 */
const subscribers = new Map<string, Set<Response>>();

export function subscribe(jobId: string, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  if (!subscribers.has(jobId)) {
    subscribers.set(jobId, new Set());
  }
  subscribers.get(jobId)!.add(res);

  res.on('close', () => {
    unsubscribe(jobId, res);
  });
}

export function unsubscribe(jobId: string, res: Response): void {
  subscribers.get(jobId)?.delete(res);
  if (subscribers.get(jobId)?.size === 0) {
    subscribers.delete(jobId);
  }
}

export function emit(jobId: string, event: CrawlEvent): void {
  const subs = subscribers.get(jobId);
  if (!subs || subs.size === 0) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of subs) {
    try {
      res.write(data);
    } catch {
      // Client disconnected mid-write — unsubscribe silently
      unsubscribe(jobId, res);
    }
  }
}

export function close(jobId: string): void {
  const subs = subscribers.get(jobId);
  if (!subs) return;
  for (const res of subs) {
    try {
      res.end();
    } catch { /* already closed */ }
  }
  subscribers.delete(jobId);
}

/** Send a keepalive ping to all subscribers of a job. */
export function keepalive(jobId: string): void {
  emit(jobId, { type: 'keepalive', timestamp: new Date().toISOString() });
}
