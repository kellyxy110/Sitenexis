// WebExtractionCapability — canonical input/output types.
// All web extraction adapters translate to/from CrawledPage (from @sitenexis/shared).
// Callers never import Puppeteer, Cheerio, or fetch helpers directly.

import type { CrawledPage } from '@sitenexis/shared';

export type { CrawledPage };

// ─── Extraction context ───────────────────────────────────────────────────────

export interface ExtractionContext {
  auditId?: string;
  domain?: string;
  traceId?: string;
}

// ─── Single-page extraction ───────────────────────────────────────────────────

export interface ExtractionOptions {
  timeoutMs?: number;          // default 12 000 ms
  maxRedirects?: number;       // default 5
  userAgent?: string;
  /** Skip image extraction for performance — images will be [] */
  skipImages?: boolean;
  ctx?: ExtractionContext;
}

export interface ExtractionOutput {
  page: CrawledPage;
  metrics: ExtractionMetrics;
}

// ─── Multi-page crawl ─────────────────────────────────────────────────────────

export interface DomainCrawlOptions {
  maxPages?: number;           // default 50
  concurrency?: number;        // default 3 (fetch), 5 (puppeteer)
  timeoutMs?: number;          // per-page timeout, default 12 000 ms
  /** Respect robots.txt disallow directives */
  respectRobotsTxt?: boolean;  // default true
  /** Called after each page is crawled — useful for streaming progress */
  onPage?: (page: CrawledPage) => void;
  ctx?: ExtractionContext;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface ExtractionMetrics {
  url: string;
  provider: string;
  statusCode: number;
  contentLengthBytes: number;
  extractionLatencyMs: number;
  headingCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  schemaDetected: boolean;
  schemaTypeCount: number;
  wordCount: number;
  success: boolean;
  timestamp: Date;
  errorCode?: string;
  auditId?: string;
  traceId?: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface ExtractionAdapterHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  checkedAt: Date;
  details?: string;
}

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * Every extraction provider implements this interface.
 * Adapters produce CrawledPage — callers never touch HTML, Cheerio, or Puppeteer.
 */
export interface WebExtractionAdapter {
  readonly provider: string;
  isConfigured(): boolean;

  /** Extract a single URL — always available. */
  extractPage(url: string, opts?: ExtractionOptions): Promise<ExtractionOutput>;

  /** Discover and crawl all pages on a domain. */
  crawlDomain(domain: string, opts?: DomainCrawlOptions): Promise<CrawledPage[]>;

  healthCheck(): Promise<ExtractionAdapterHealth>;
}
