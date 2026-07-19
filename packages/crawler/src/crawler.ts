import EventEmitter from 'node:events';
import puppeteer, { type Browser } from 'puppeteer';
import * as cheerio from 'cheerio';
import { type CrawledPage, type CrawlResult } from '@sitenexis/shared';
import { RobotsParser } from './robots';
import { fetchSitemapUrls } from './sitemap';
import { extractLinkRefs } from './extractor';

const USER_AGENT = 'SiteNexis-Bot/1.0 (+https://sitenexis.com/bot)';
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT_MS = 15_000;
const NETWORK_IDLE_TIMEOUT_MS = 8_000;
const MAX_REDIRECT_HOPS = 5;

// Flattens @graph-wrapped JSON-LD (multiple entities in one <script> tag) into
// individual entity objects, so downstream schema checks (sameAs, @type, etc.)
// see each entity instead of one opaque { @context, @graph: [...] } wrapper.
function flattenJsonLd(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => flattenJsonLd(item));
  }
  if (parsed && typeof parsed === 'object') {
    const graph = (parsed as Record<string, unknown>)['@graph'];
    if (Array.isArray(graph)) {
      return graph;
    }
  }
  return [parsed];
}

export interface CrawlOptions {
  maxPages?: number;
  concurrency?: number;
  timeoutMs?: number;
  /** If true, also enqueue external links (never followed — collected only). */
  collectExternalLinks?: boolean;
  layer4Enabled?: boolean;
}

export interface CrawlEvents {
  'page:crawled': [page: CrawledPage];
  'page:error': [url: string, error: Error];
  'crawl:complete': [result: CrawlResult];
}

/**
 * Full-site web crawler that mimics Googlebot behaviour.
 * Emits typed events for real-time progress streaming.
 *
 * Usage:
 *   const crawler = new DomainCrawler(auditId, domain, options);
 *   crawler.on('page:crawled', (page) => { … });
 *   const result = await crawler.run();
 */
export class DomainCrawler extends EventEmitter {
  private readonly auditId: string;
  private readonly domain: string;
  private readonly options: Required<CrawlOptions>;

  constructor(auditId: string, domain: string, options: CrawlOptions = {}) {
    super();
    this.auditId = auditId;
    this.domain = normalizeDomain(domain);
    this.options = {
      maxPages: options.maxPages ?? DEFAULT_MAX_PAGES,
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      collectExternalLinks: options.collectExternalLinks ?? false,
      layer4Enabled: options.layer4Enabled ?? false,
    };
  }

  async run(): Promise<CrawlResult> {
    const startTime = Date.now();
    const robots = await RobotsParser.fetch(this.domain);
    const sitemapUrls = await fetchSitemapUrls(this.domain);

    const visited = new Set<string>();
    // Use Map to preserve insertion order and enable O(1) dequeue from front
    const queue: string[] = [this.domain];

    for (const url of sitemapUrls) {
      const clean = normalizeUrl(url);
      if (isSameDomain(clean, this.domain) && !queue.includes(clean)) {
        queue.push(clean);
      }
    }

    const pages: CrawledPage[] = [];
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      while (queue.length > 0 && pages.length < this.options.maxPages) {
        const batch = queue.splice(0, this.options.concurrency);
        const results = await Promise.allSettled(
          batch.map((url) => this.crawlPage(browser, url, robots, visited))
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value !== null) {
            const page = result.value;
            pages.push(page);
            this.emit('page:crawled', page);

            for (const link of page.internalLinks) {
              const clean = normalizeUrl(link);
              if (!visited.has(clean) && !queue.includes(clean)) {
                queue.push(clean);
              }
            }
          }
        }
      }
    } finally {
      await browser.close();
    }

    const result: CrawlResult = {
      auditId: this.auditId,
      domain: this.domain,
      pages,
      crawlDurationMs: Date.now() - startTime,
    };

    this.emit('crawl:complete', result);
    return result;
  }

  private async crawlPage(
    browser: Browser,
    url: string,
    robots: RobotsParser,
    visited: Set<string>
  ): Promise<CrawledPage | null> {
    const normalized = normalizeUrl(url);

    if (visited.has(normalized)) return null;
    if (!robots.isAllowed(normalized)) return null;
    visited.add(normalized);

    const page = await browser.newPage();

    try {
      await page.setUserAgent(USER_AGENT);

      // Block images and fonts for speed — we only need rendered text and structure
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (type === 'image' || type === 'font' || type === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });

      const start = Date.now();
      const response = await page.goto(normalized, {
        waitUntil: 'networkidle2',
        timeout: Math.min(this.options.timeoutMs, NETWORK_IDLE_TIMEOUT_MS + 7_000),
      }).catch(async () => {
        // Fallback: if networkidle2 times out, settle for domcontentloaded
        return page.goto(normalized, {
          waitUntil: 'domcontentloaded',
          timeout: NETWORK_IDLE_TIMEOUT_MS,
        }).catch(() => null);
      });

      if (!response) return null;

      const statusCode = response.status();
      const contentType = response.headers()['content-type'] ?? '';
      if (!contentType.includes('text/html')) return null;

      const redirectChain = response
        .request()
        .redirectChain()
        .slice(0, MAX_REDIRECT_HOPS)
        .map((r) => r.url());

      const html = await page.content();
      const responseTimeMs = Date.now() - start;

      return parseHtml(normalized, html, statusCode, redirectChain, this.domain, responseTimeMs);
    } catch (err) {
      this.emit('page:error', normalized, err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      await page.close();
    }
  }
}

/**
 * Functional entry point — convenience wrapper over DomainCrawler.
 * Prefer DomainCrawler directly when you need event streaming.
 */
export async function crawlDomain(
  auditId: string,
  domain: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const crawler = new DomainCrawler(auditId, domain, options);
  return crawler.run();
}

// ─── HTML parsing ─────────────────────────────────────────────────────────────

function parseHtml(
  url: string,
  html: string,
  statusCode: number,
  redirectChain: string[],
  domain: string,
  responseTimeMs: number
): CrawledPage {
  const $ = cheerio.load(html);

  // Remove noise before extracting body text
  $('script, style, noscript, svg, iframe').remove();

  const title = $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? null;
  const h1 = $('h1').first().text().trim() || null;
  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() ?? null;

  const headings: CrawledPage['headings'] = [];
  $('h1, h2, h3').each((_, el) => {
    const level = parseInt(((el as unknown as { tagName: string }).tagName).slice(1), 10);
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const robotsMeta = $('meta[name="robots"]').attr('content') ?? '';
  const robotsDirectives = robotsMeta
    ? robotsMeta.split(',').map((d) => d.trim().toLowerCase())
    : [];

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const resolved = new URL(href, url).href;
      const clean = normalizeUrl(resolved);
      if (isSameDomain(clean, domain)) {
        if (!internalLinks.includes(clean)) internalLinks.push(clean);
      } else {
        if (!externalLinks.includes(resolved)) externalLinks.push(resolved);
      }
    } catch {
      // ignore malformed hrefs
    }
  });

  const images: CrawledPage['images'] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') ?? null;
    if (src) images.push({ src, alt });
  });

  const schemaMarkup: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? '';
      if (raw.trim()) {
        const parsed: unknown = JSON.parse(raw);
        schemaMarkup.push(...flattenJsonLd(parsed));
      }
    } catch {
      // ignore invalid JSON-LD
    }
  });

  const { internalLinkRefs, externalLinkMeta } = extractLinkRefs(html, url, domain);

  return {
    url,
    statusCode,
    redirectChain,
    title,
    metaDescription,
    h1,
    headings,
    bodyText,
    wordCount,
    internalLinks,
    externalLinks,
    images,
    canonicalUrl,
    robotsDirectives,
    schemaMarkup,
    responseTimeMs,
    contentType: 'text/html',
    crawledAt: new Date(),
    internalLinkRefs,
    externalLinkMeta,
  };
}

// ─── URL utilities ────────────────────────────────────────────────────────────

/**
 * Normalise a domain input to its canonical origin (scheme + host, no trailing slash).
 * Auto-prefixes https:// if no protocol is present.
 */
function normalizeDomain(domain: string): string {
  const withProtocol = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const u = new URL(withProtocol);
  return `${u.protocol}//${u.hostname}`;
}

/**
 * Strip fragment, normalise trailing slash, and lowercase scheme+host.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    const path = u.pathname.replace(/\/$/, '') || '/';
    return `${u.protocol}//${u.hostname}${path}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * True if `url` belongs to the same hostname (or a subdomain) as `domain`.
 */
function isSameDomain(url: string, domain: string): boolean {
  try {
    const urlHost = new URL(url).hostname;
    const domainHost = new URL(domain).hostname;
    return urlHost === domainHost || urlHost.endsWith(`.${domainHost}`);
  } catch {
    return false;
  }
}
