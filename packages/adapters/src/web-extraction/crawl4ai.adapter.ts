// Crawl4aiExtractionAdapter — HTTP bridge to a Python crawl4ai microservice.
// When CRAWL4AI_URL env var is set, registers as primary extraction provider.
// When not configured, isConfigured() returns false and the registry falls back to fetch.
//
// To run the crawl4ai service locally:
//   pip install crawl4ai
//   crawl4ai-server --port 11235
// Or via Docker: https://docs.crawl4ai.com/docker

import type { CrawledPage } from '@sitenexis/shared';
import type {
  WebExtractionAdapter,
  ExtractionOptions,
  ExtractionOutput,
  ExtractionMetrics,
  DomainCrawlOptions,
  ExtractionAdapterHealth,
} from './interface';
import { validateExtractionUrl } from './security';

const DEFAULT_TIMEOUT_MS = 30_000;
const DOMAIN_CRAWL_TIMEOUT_MULTIPLIER = 10;

// ─── Crawl4ai response shape ──────────────────────────────────────────────────

interface Crawl4aiPageResult {
  url: string;
  status_code?: number;
  title?: string | null;
  description?: string | null;
  h1?: string | null;
  headings?: Array<{ level: number; text: string }>;
  body_text?: string;
  word_count?: number;
  internal_links?: string[];
  external_links?: string[];
  schema_markup?: unknown[];
  schema_types?: string[];
  has_structured_data?: boolean;
  canonical_url?: string | null;
  robots_directives?: string[];
  response_time_ms?: number;
  error?: string;
}

interface Crawl4aiDomainResult {
  pages: Crawl4aiPageResult[];
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapResult(r: Crawl4aiPageResult, crawledAt: Date): CrawledPage {
  return {
    url: r.url,
    statusCode: r.status_code ?? 200,
    redirectChain: [],
    title: r.title ?? null,
    metaDescription: r.description ?? null,
    h1: r.h1 ?? null,
    headings: r.headings ?? [],
    bodyText: r.body_text ?? '',
    wordCount: r.word_count ?? 0,
    internalLinks: r.internal_links ?? [],
    externalLinks: r.external_links ?? [],
    images: [],
    canonicalUrl: r.canonical_url ?? null,
    robotsDirectives: r.robots_directives ?? [],
    schemaMarkup: r.schema_markup ?? [],
    schemaTypes: r.schema_types ?? [],
    hasStructuredData: r.has_structured_data ?? false,
    responseTimeMs: r.response_time_ms ?? 0,
    contentType: 'text/html',
    crawledAt,
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class Crawl4aiExtractionAdapter implements WebExtractionAdapter {
  readonly provider = 'crawl4ai';
  private readonly serviceUrl: string;

  constructor(serviceUrl?: string) {
    this.serviceUrl = (serviceUrl ?? process.env['CRAWL4AI_URL'] ?? '').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return this.serviceUrl.length > 0;
  }

  async extractPage(url: string, opts?: ExtractionOptions): Promise<ExtractionOutput> {
    const validUrl = validateExtractionUrl(url);
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const crawledAt = new Date();
    const start = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.serviceUrl}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: validUrl.href,
          skip_images: opts?.skipImages ?? true,
          ...(opts?.userAgent ? { user_agent: opts.userAgent } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return this.emptyOutput(validUrl.href, crawledAt, latencyMs, res.status, opts, 'http_error');
      }

      const data = await res.json() as Crawl4aiPageResult;
      if (data.error) {
        return this.emptyOutput(validUrl.href, crawledAt, latencyMs, data.status_code ?? 0, opts, data.error.slice(0, 64));
      }

      const page = mapResult(data, crawledAt);
      return { page, metrics: this.buildMetrics(url, page, latencyMs, data.status_code ?? res.status, 0, opts) };
    } catch (err) {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const code = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'request_failed';
      return this.emptyOutput(validUrl.href, crawledAt, latencyMs, 0, opts, code);
    }
  }

  async crawlDomain(domain: string, opts?: DomainCrawlOptions): Promise<CrawledPage[]> {
    const maxPages = opts?.maxPages ?? 50;
    const perPageMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const totalTimeoutMs = perPageMs * DOMAIN_CRAWL_TIMEOUT_MULTIPLIER;
    const crawledAt = new Date();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), totalTimeoutMs);

    try {
      const res = await fetch(`${this.serviceUrl}/crawl-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          max_pages: maxPages,
          concurrency: opts?.concurrency ?? 3,
          respect_robots_txt: opts?.respectRobotsTxt ?? true,
          per_page_timeout_ms: perPageMs,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return [];

      const data = await res.json() as Crawl4aiDomainResult;
      const pages: CrawledPage[] = (data.pages ?? [])
        .slice(0, maxPages)
        .map((r) => mapResult(r, crawledAt));

      pages.forEach((p) => opts?.onPage?.(p));
      return pages;
    } catch {
      clearTimeout(timer);
      return [];
    }
  }

  async healthCheck(): Promise<ExtractionAdapterHealth> {
    if (!this.isConfigured()) {
      return { provider: 'crawl4ai', status: 'unavailable', latencyMs: 0, checkedAt: new Date(), details: 'CRAWL4AI_URL not configured' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`${this.serviceUrl}/health`, { signal: AbortSignal.timeout(5_000) });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { provider: 'crawl4ai', status: 'healthy', latencyMs, checkedAt: new Date() };
      }
      return { provider: 'crawl4ai', status: 'degraded', latencyMs, checkedAt: new Date(), details: `HTTP ${res.status}` };
    } catch (err) {
      return { provider: 'crawl4ai', status: 'unavailable', latencyMs: Date.now() - start, checkedAt: new Date(), details: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private emptyOutput(
    url: string, crawledAt: Date, latencyMs: number, statusCode: number,
    opts: ExtractionOptions | undefined, errorCode: string,
  ): ExtractionOutput {
    const page: CrawledPage = {
      url, statusCode, redirectChain: [], title: null, metaDescription: null, h1: null,
      headings: [], bodyText: '', wordCount: 0, internalLinks: [], externalLinks: [], images: [],
      canonicalUrl: null, robotsDirectives: [], schemaMarkup: [], schemaTypes: [],
      hasStructuredData: false, responseTimeMs: latencyMs, contentType: 'text/html', crawledAt,
    };
    return { page, metrics: this.buildMetrics(url, page, latencyMs, statusCode, 0, opts, errorCode) };
  }

  private buildMetrics(
    url: string, page: CrawledPage, latencyMs: number, statusCode: number,
    contentLengthBytes: number, opts: ExtractionOptions | undefined, errorCode?: string,
  ): ExtractionMetrics {
    const m: ExtractionMetrics = {
      url, provider: 'crawl4ai', statusCode, contentLengthBytes,
      extractionLatencyMs: latencyMs,
      headingCount: page.headings.length,
      internalLinkCount: page.internalLinks.length,
      externalLinkCount: page.externalLinks.length,
      schemaDetected: page.hasStructuredData ?? false,
      schemaTypeCount: page.schemaTypes?.length ?? 0,
      wordCount: page.wordCount,
      success: !errorCode,
      timestamp: new Date(),
    };
    if (errorCode) (m as ExtractionMetrics & { errorCode: string }).errorCode = errorCode;
    if (opts?.ctx?.auditId) (m as ExtractionMetrics & { auditId: string }).auditId = opts.ctx.auditId;
    if (opts?.ctx?.traceId) (m as ExtractionMetrics & { traceId: string }).traceId = opts.ctx.traceId;
    return m;
  }
}

let _instance: Crawl4aiExtractionAdapter | undefined;

export function getCrawl4aiExtractionAdapter(serviceUrl?: string): Crawl4aiExtractionAdapter {
  if (!_instance || serviceUrl) _instance = new Crawl4aiExtractionAdapter(serviceUrl);
  return _instance;
}
