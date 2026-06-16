import { DomainCrawler } from '@sitenexis/crawler/crawler';
import type { CrawledPage } from '@sitenexis/shared';
import { addPage, getJob, updateJob } from './job-store.js';
import { emit, close } from './sse.js';

export interface BridgeOptions {
  maxPages?: number;
  concurrency?: number;
}

/**
 * Runs a DomainCrawler for the given job, streaming SSE events as each
 * page completes. Uses the existing DomainCrawler event emitter interface —
 * no modifications to the crawler package required.
 *
 * Snapshot-first rule: this bridge is only invoked for initial crawls or
 * when the caller has determined the existing snapshot is stale/missing.
 */
export async function runCrawlBridge(
  jobId: string,
  domain: string,
  options: BridgeOptions = {},
): Promise<void> {
  const startedAt = new Date();
  updateJob(jobId, { status: 'running', startedAt });

  emit(jobId, {
    type: 'started',
    jobId,
    domain,
    maxPages: options.maxPages ?? 500,
    timestamp: startedAt.toISOString(),
  });

  // Keepalive: ping every 20 seconds so proxies don't close idle SSE connections
  const keepaliveTimer = setInterval(() => {
    emit(jobId, { type: 'keepalive', timestamp: new Date().toISOString() });
  }, 20_000);

  try {
    const crawler = new DomainCrawler(jobId, domain, {
      maxPages: options.maxPages ?? 500,
      concurrency: options.concurrency ?? 4,
    });

    crawler.on('page:crawled', (page: CrawledPage) => {
      addPage(jobId, page);

      const job = getJobPageCount(jobId);

      emit(jobId, {
        type: 'page_crawled',
        jobId,
        url:        page.url,
        statusCode: page.statusCode,
        wordCount:  page.wordCount,
        chunkCount: 0, // chunks computed post-crawl by extractor
        hasSchema:  (page.schemaMarkup as unknown[]).length > 0,
        timestamp:  new Date().toISOString(),
      });

      emit(jobId, {
        type: 'progress',
        jobId,
        pagesProcessed:  job.pagesProcessed,
        pagesDiscovered: job.pagesDiscovered,
        timestamp:       new Date().toISOString(),
      });
    });

    crawler.on('page:error', (url: string, error: Error) => {
      emit(jobId, {
        type:      'page_failed',
        jobId,
        url,
        error:     error.message.slice(0, 200),
        timestamp: new Date().toISOString(),
      });
    });

    const result = await crawler.run();
    const completedAt = new Date();

    updateJob(jobId, {
      status:           'completed',
      completedAt,
      pagesDiscovered:  result.pages.length,
    });

    emit(jobId, {
      type:       'completed',
      jobId,
      pagesCount: result.pages.length,
      durationMs: result.crawlDurationMs,
      timestamp:  completedAt.toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    updateJob(jobId, { status: 'failed', error, completedAt: new Date() });

    emit(jobId, {
      type:      'failed',
      jobId,
      error:     error.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
  } finally {
    clearInterval(keepaliveTimer);
    close(jobId);
  }
}

function getJobPageCount(jobId: string): {
  pagesProcessed: number;
  pagesDiscovered: number;
} {
  const job = getJob(jobId);
  return {
    pagesProcessed:  job?.pagesProcessed ?? 0,
    pagesDiscovered: job?.pagesDiscovered ?? 0,
  };
}
