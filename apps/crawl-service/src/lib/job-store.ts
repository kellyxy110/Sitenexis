import type { CrawledPage } from '@sitenexis/shared';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CrawlJob {
  id: string;
  domain: string;
  maxPages: number;
  status: JobStatus;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  pagesProcessed: number;
  pagesDiscovered: number;
  pages: CrawledPage[];
  error: string | null;
}

// In-memory store — for production, replace with Redis or Supabase persistence.
const jobs = new Map<string, CrawlJob>();

export function createJob(
  id: string,
  domain: string,
  maxPages: number,
): CrawlJob {
  const job: CrawlJob = {
    id,
    domain,
    maxPages,
    status: 'pending',
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    pagesProcessed: 0,
    pagesDiscovered: 0,
    pages: [],
    error: null,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): CrawlJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<CrawlJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function addPage(id: string, page: CrawledPage): void {
  const job = jobs.get(id);
  if (!job) return;
  job.pages.push(page);
  job.pagesProcessed++;
}

/** Evict jobs older than 30 minutes to prevent unbounded memory growth. */
export function evictExpiredJobs(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt.getTime() < cutoff) {
      jobs.delete(id);
    }
  }
}
