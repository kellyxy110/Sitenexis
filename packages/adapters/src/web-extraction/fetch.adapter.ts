// FetchExtractionAdapter — serverless-compatible web extraction.
// Uses native fetch + regex parsing. No Puppeteer, no Redis, no worker process.
// All logic extracted from apps/web/src/lib/serverless-audit.ts.

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

const DEFAULT_TIMEOUT_MS = 12_000;
// The homepage decides the whole audit — give it more room and a retry, since large
// sites behind bot mitigation/CDNs are slow on the first (cold) request.
const HOMEPAGE_TIMEOUT_MS = 22_000;
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_CONCURRENCY = 3;
// A realistic browser UA. The previous "SiteNexis-Audit/1.0 (+…/bot)" string was
// blocked outright (403/challenge) by enterprise bot mitigation (Akamai/Cloudflare),
// which caused audits of large sites (e.g. mayoclinic.org) to fail with zero pages.
// Standard for audit/render tools (Lighthouse/PageSpeed present a Chrome UA too).
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Root-domain compare so www / non-www (and other subdomains) are treated as same-site. */
function sameSite(hostA: string, hostB: string): boolean {
  const root = (h: string): string => {
    const parts = h.toLowerCase().replace(/^www\./, '').split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.');
  };
  return root(hostA) === root(hostB);
}

/** Extract HTTP response headers into a plain lower-cased object (defensive: mocks may omit). */
function extractHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const h = headers as { forEach?: (cb: (v: string, k: string) => void) => void } | undefined;
  if (h && typeof h.forEach === 'function') {
    h.forEach((value, key) => { out[key.toLowerCase()] = value; });
  }
  return out;
}

// ─── HTML parsing ─────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseHtml(
  html: string,
  pageUrl: string,
): Omit<CrawledPage, 'url' | 'statusCode' | 'responseTimeMs' | 'crawledAt' | 'redirectChain' | 'contentType' | 'images'> {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ') ?? null;

  const metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)[^>]+name=["']description["']/i)?.[1] ??
    null;

  const h1Raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null;
  const h1 = h1Raw ? stripTags(h1Raw).slice(0, 200) : null;

  const canonicalUrl =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)[^>]+rel=["']canonical["']/i)?.[1] ??
    null;

  const robotsMeta =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)[^>]+name=["']robots["']/i)?.[1] ??
    null;
  const robotsDirectives: string[] = robotsMeta ? [robotsMeta] : [];

  // JSON-LD schemas
  const schemaMatches = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  const schemaMarkup = schemaMatches
    .map((m) => {
      try { return JSON.parse(m[1]!) as unknown; } catch { return null; }
    })
    .filter(Boolean) as unknown[];

  const schemaTypes = schemaMarkup
    .map((s) => {
      if (typeof s === 'object' && s !== null && '@type' in s) {
        return String((s as Record<string, unknown>)['@type']);
      }
      return null;
    })
    .filter((t): t is string => t !== null);

  // Open Graph
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i)?.[1];
  const ogDescription = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)?.[1];
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i)?.[1];
  const ogType = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)/i)?.[1];
  const openGraph: CrawledPage['openGraph'] = {};
  if (ogTitle) openGraph.title = ogTitle;
  if (ogDescription) openGraph.description = ogDescription;
  if (ogImage) openGraph.image = ogImage;
  if (ogType) openGraph.type = ogType;

  // Headings H1-H6
  const headings: { level: number; text: string }[] = [];
  if (h1) headings.push({ level: 1, text: h1 });
  for (const m of html.matchAll(/<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ level: parseInt(m[1]!), text: stripTags(m[2]!).slice(0, 150) });
  }

  // Body text
  let bodyHtml = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  bodyHtml = bodyHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  const bodyText = stripTags(bodyHtml).slice(0, 50_000);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // Links
  const origin = new URL(pageUrl).origin;
  const allHrefs = [...html.matchAll(/href=["']([^"'#?\s]+)/gi)].map((m) => m[1]!);
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  for (const href of allHrefs) {
    try {
      const abs = new URL(href, pageUrl).href;
      if (abs.startsWith(origin)) {
        if (!internalLinks.includes(abs) && abs !== pageUrl) internalLinks.push(abs);
      } else if (href.startsWith('http')) {
        if (!externalLinks.includes(abs)) externalLinks.push(abs);
      }
    } catch { /* skip malformed */ }
  }

  return {
    title,
    metaDescription,
    h1,
    headings,
    bodyText,
    wordCount,
    internalLinks: internalLinks.slice(0, 200),
    externalLinks: externalLinks.slice(0, 50),
    canonicalUrl,
    robotsDirectives,
    schemaMarkup,
    schemaTypes,
    hasStructuredData: schemaMarkup.length > 0,
    ...(Object.keys(openGraph).length > 0 ? { openGraph } : {}),
  };
}

function buildMetrics(
  url: string,
  page: CrawledPage,
  latencyMs: number,
  statusCode: number,
  contentLengthBytes: number,
  opts: ExtractionOptions | undefined,
  error?: string,
): ExtractionMetrics {
  const base: ExtractionMetrics = {
    url,
    provider: 'fetch',
    statusCode,
    contentLengthBytes,
    extractionLatencyMs: latencyMs,
    headingCount: page.headings.length,
    internalLinkCount: page.internalLinks.length,
    externalLinkCount: page.externalLinks.length,
    schemaDetected: page.hasStructuredData ?? false,
    schemaTypeCount: page.schemaTypes?.length ?? 0,
    wordCount: page.wordCount,
    success: !error,
    timestamp: new Date(),
  };
  if (error) (base as ExtractionMetrics & { errorCode: string }).errorCode = error;
  if (opts?.ctx?.auditId) (base as ExtractionMetrics & { auditId: string }).auditId = opts.ctx.auditId;
  if (opts?.ctx?.traceId) (base as ExtractionMetrics & { traceId: string }).traceId = opts.ctx.traceId;
  return base;
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

interface FetchRawResult {
  html: string;
  statusCode: number;
  ms: number;
  contentLength: number;
  /** URL after following redirects (falls back to the requested URL). */
  finalUrl: string;
  headers: Record<string, string>;
}

async function fetchRaw(
  url: string,
  timeoutMs: number,
  userAgent: string,
): Promise<FetchRawResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    return {
      html,
      statusCode: res.status,
      ms: Date.now() - t,
      contentLength: html.length,
      finalUrl: (res as { url?: string }).url || url,
      headers: extractHeaders((res as { headers?: unknown }).headers),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch with one retry on failure/5xx — the homepage gates the whole audit. */
async function fetchWithRetry(url: string, timeoutMs: number, userAgent: string): Promise<FetchRawResult | null> {
  const first = await fetchRaw(url, timeoutMs, userAgent);
  if (first && first.statusCode < 500) return first;
  const second = await fetchRaw(url, timeoutMs, userAgent);
  return second ?? first;
}

async function fetchSitemapUrls(domain: string, timeoutMs: number, userAgent: string, maxPages: number): Promise<string[]> {
  const base = `https://${domain}`;
  const candidates = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap/sitemap.xml`,
  ];
  for (const sitemapUrl of candidates) {
    try {
      const result = await fetchRaw(sitemapUrl, timeoutMs, userAgent);
      if (!result || result.statusCode !== 200) continue;
      const urls = [...result.html.matchAll(/<loc>(.*?)<\/loc>/gi)]
        .map((m) => m[1]!.trim())
        .filter((u) => {
          if (!u.startsWith('http')) return false;
          try { return sameSite(new URL(u).hostname, domain); } catch { return false; }
        });
      if (urls.length > 0) return urls.slice(0, maxPages);
    } catch { /* try next */ }
  }
  return [];
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class FetchExtractionAdapter implements WebExtractionAdapter {
  readonly provider = 'fetch';

  isConfigured(): boolean {
    // Fetch is always available in any Node.js 18+ / edge runtime
    return true;
  }

  async extractPage(url: string, opts?: ExtractionOptions): Promise<ExtractionOutput> {
    const validUrl = validateExtractionUrl(url); // throws URLValidationError if unsafe
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const userAgent = opts?.userAgent ?? DEFAULT_USER_AGENT;

    const start = Date.now();
    const raw = await fetchRaw(validUrl.href, timeoutMs, userAgent);

    const emptyPage: CrawledPage = {
      url: validUrl.href,
      statusCode: raw?.statusCode ?? 0,
      redirectChain: [],
      title: null, metaDescription: null, h1: null,
      headings: [], bodyText: '', wordCount: 0,
      internalLinks: [], externalLinks: [], images: [],
      canonicalUrl: null, robotsDirectives: [], schemaMarkup: [],
      responseTimeMs: Date.now() - start,
      contentType: 'text/html',
      crawledAt: new Date(),
      schemaTypes: [], hasStructuredData: false,
    };

    if (!raw || raw.statusCode >= 400) {
      const latencyMs = Date.now() - start;
      return {
        page: emptyPage,
        metrics: buildMetrics(url, emptyPage, latencyMs, raw?.statusCode ?? 0, 0, opts, 'fetch_failed'),
      };
    }

    const finalUrl = raw.finalUrl;
    const parsed = parseHtml(raw.html, finalUrl);
    const page: CrawledPage = {
      url: finalUrl,
      statusCode: raw.statusCode,
      redirectChain: finalUrl !== validUrl.href ? [validUrl.href, finalUrl] : [],
      responseTimeMs: raw.ms,
      contentType: 'text/html',
      crawledAt: new Date(),
      images: [],
      responseHeaders: raw.headers,
      ...parsed,
    };

    return {
      page,
      metrics: buildMetrics(url, page, raw.ms, raw.statusCode, raw.contentLength, opts),
    };
  }

  async crawlDomain(domain: string, opts?: DomainCrawlOptions): Promise<CrawledPage[]> {
    const maxPages = opts?.maxPages ?? DEFAULT_MAX_PAGES;
    const concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const userAgent = DEFAULT_USER_AGENT;
    const baseUrl = `https://${domain}`;

    // Discover URLs from sitemap
    const sitemapUrls = await fetchSitemapUrls(domain, timeoutMs, userAgent, maxPages);
    let urls: string[] = sitemapUrls.length > 0
      ? [baseUrl, ...sitemapUrls.filter((u) => u !== baseUrl)].slice(0, maxPages)
      : [baseUrl];

    const pages: CrawledPage[] = [];

    // Always crawl homepage first — with a longer timeout + retry, since it gates the audit.
    const homeRaw = await fetchWithRetry(baseUrl, Math.max(timeoutMs, HOMEPAGE_TIMEOUT_MS), userAgent);
    if (!homeRaw || homeRaw.statusCode >= 400) return pages;

    // Use the post-redirect URL as the origin so www/non-www internal links classify
    // correctly (otherwise every link looks external and discovery finds nothing).
    const homeUrl = homeRaw.finalUrl;
    const homeParsed = parseHtml(homeRaw.html, homeUrl);
    const homePage: CrawledPage = {
      url: homeUrl, statusCode: homeRaw.statusCode,
      redirectChain: homeUrl !== baseUrl ? [baseUrl, homeUrl] : [],
      responseTimeMs: homeRaw.ms, contentType: 'text/html', crawledAt: new Date(), images: [],
      responseHeaders: homeRaw.headers,
      ...homeParsed,
    };
    pages.push(homePage);
    opts?.onPage?.(homePage);

    // If no sitemap, discover from homepage links
    if (sitemapUrls.length === 0) {
      const discovered = homeParsed.internalLinks
        .filter((u) => {
          try {
            const p = new URL(u).pathname;
            return p !== '/' && !p.match(/\.(jpg|png|gif|svg|pdf|css|js|ico|woff2?)$/i);
          } catch { return false; }
        })
        .slice(0, maxPages - 1);
      urls = [baseUrl, ...discovered];
    }

    // Crawl remaining pages in batches
    const remaining = urls.slice(1);
    for (let i = 0; i < remaining.length; i += concurrency) {
      const batch = remaining.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((u) => fetchRaw(u, timeoutMs, userAgent)),
      );
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result && result.statusCode < 400) {
          const batchUrl = batch[j]!;
          const p: CrawledPage = {
            url: batchUrl, statusCode: result.statusCode, redirectChain: [],
            responseTimeMs: result.ms, contentType: 'text/html', crawledAt: new Date(), images: [],
            ...parseHtml(result.html, batchUrl),
          };
          pages.push(p);
          opts?.onPage?.(p);
        }
      }
      if (pages.length >= maxPages) break;
    }

    return pages.slice(0, maxPages);
  }

  async healthCheck(): Promise<ExtractionAdapterHealth> {
    // Fetch is a runtime primitive — always healthy if we can execute
    return {
      provider: 'fetch',
      status: 'healthy',
      latencyMs: 0,
      checkedAt: new Date(),
      details: 'Native fetch — no external dependency',
    };
  }
}

let _instance: FetchExtractionAdapter | undefined;

export function getFetchExtractionAdapter(): FetchExtractionAdapter {
  _instance ??= new FetchExtractionAdapter();
  return _instance;
}
