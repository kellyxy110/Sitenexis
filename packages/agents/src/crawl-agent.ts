import { type CrawledPage } from '@sitenexis/shared';
import { saveCrawledPages, updateAuditStatus } from '@sitenexis/db';
import { crawlDomain } from '@sitenexis/crawler';
import { emitAgentEvent } from './registry';

export interface CrawlAgentInput {
  auditId: string;
  domain: string;
  maxPages?: number;
}

export async function runCrawlAgent(input: CrawlAgentInput): Promise<CrawledPage[]> {
  const { auditId, domain, maxPages } = input;

  await emitAgentEvent({ auditId, agentId: 'crawl', event: 'started' });

  try {
    const result = await crawlDomain(
      auditId,
      domain,
      maxPages !== undefined ? { maxPages } : {}
    );

    await saveCrawledPages(auditId, result.pages);

    await emitAgentEvent({
      auditId,
      agentId: 'crawl',
      event: 'completed',
      payload: { pageCount: result.pages.length, durationMs: result.crawlDurationMs },
    });

    return result.pages;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await emitAgentEvent({ auditId, agentId: 'crawl', event: 'failed', errorMessage });
    await updateAuditStatus(auditId, 'failed');
    throw err;
  }
}
