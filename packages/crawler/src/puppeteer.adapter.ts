// PuppeteerExtractionAdapter — full JS-rendered web extraction via Puppeteer.
// Wraps DomainCrawler. Only safe in the BullMQ worker process — not on Vercel serverless.
// Import from '@sitenexis/crawler/puppeteer-adapter', never from the default barrel.

import type {
  WebExtractionAdapter,
  ExtractionOptions,
  ExtractionOutput,
  ExtractionMetrics,
  DomainCrawlOptions,
  ExtractionAdapterHealth,
} from '@sitenexis/adapters';
import type { CrawledPage } from '@sitenexis/shared';
import { DomainCrawler, type CrawlOptions } from './crawler';

export class PuppeteerExtractionAdapter implements WebExtractionAdapter {
  readonly provider = 'puppeteer';

  isConfigured(): boolean {
    // Puppeteer is a static dependency — always available in the worker process.
    // This will throw at module load time on Vercel, which is the intended guard.
    return true;
  }

  async extractPage(url: string, opts?: ExtractionOptions): Promise<ExtractionOutput> {
    const auditId = opts?.ctx?.auditId ?? `single-${Date.now()}`;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    const domain = parsed.hostname;

    const crawlOpts: CrawlOptions = {
      maxPages: 1,
      concurrency: 1,
      timeoutMs: opts?.timeoutMs ?? 15_000,
    };

    const crawler = new DomainCrawler(auditId, domain, crawlOpts);
    const result = await crawler.run();

    const page = result.pages.find((p) => p.url === url) ?? result.pages[0];

    if (!page) {
      const empty: CrawledPage = {
        url, statusCode: 0, redirectChain: [], title: null, metaDescription: null,
        h1: null, headings: [], bodyText: '', wordCount: 0,
        internalLinks: [], externalLinks: [], images: [],
        canonicalUrl: null, robotsDirectives: [], schemaMarkup: [],
        responseTimeMs: result.crawlDurationMs, contentType: 'text/html', crawledAt: new Date(),
      };
      const metrics = buildMetrics(url, empty, result.crawlDurationMs, 0, 0, opts, 'no_page_returned');
      return { page: empty, metrics };
    }

    const metrics = buildMetrics(url, page, page.responseTimeMs, page.statusCode, page.bodyText.length, opts);
    return { page, metrics };
  }

  async crawlDomain(domain: string, opts?: DomainCrawlOptions): Promise<CrawledPage[]> {
    const auditId = opts?.ctx?.auditId ?? `crawl-${Date.now()}`;
    const crawlOpts: CrawlOptions = {
      maxPages: opts?.maxPages ?? 50,
      concurrency: opts?.concurrency ?? 5,
      timeoutMs: opts?.timeoutMs ?? 15_000,
    };

    const crawler = new DomainCrawler(auditId, domain, crawlOpts);

    if (opts?.onPage) {
      crawler.on('page:crawled', opts.onPage);
    }

    const result = await crawler.run();
    return result.pages;
  }

  async healthCheck(): Promise<ExtractionAdapterHealth> {
    const start = Date.now();
    try {
      const { default: puppeteer } = await import('puppeteer');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      await browser.close();
      return {
        provider: 'puppeteer',
        status: 'healthy',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      return {
        provider: 'puppeteer',
        status: 'unavailable',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

function buildMetrics(
  url: string,
  page: CrawledPage,
  latencyMs: number,
  statusCode: number,
  contentLengthBytes: number,
  opts: ExtractionOptions | undefined,
  errorCode?: string,
): ExtractionMetrics {
  const base: ExtractionMetrics = {
    url,
    provider: 'puppeteer',
    statusCode,
    contentLengthBytes,
    extractionLatencyMs: latencyMs,
    headingCount: page.headings.length,
    internalLinkCount: page.internalLinks.length,
    externalLinkCount: page.externalLinks.length,
    schemaDetected: page.hasStructuredData ?? page.schemaMarkup.length > 0,
    schemaTypeCount: page.schemaTypes?.length ?? 0,
    wordCount: page.wordCount,
    success: !errorCode,
    timestamp: new Date(),
  };
  if (errorCode) (base as ExtractionMetrics & { errorCode: string }).errorCode = errorCode;
  if (opts?.ctx?.auditId) (base as ExtractionMetrics & { auditId: string }).auditId = opts.ctx.auditId;
  if (opts?.ctx?.traceId) (base as ExtractionMetrics & { traceId: string }).traceId = opts.ctx.traceId;
  return base;
}
