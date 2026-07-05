# WebExtractionCapability

**Version:** 1.0  
**Package:** `@sitenexis/adapters`  
**Status:** Production

---

## Purpose

WebExtractionCapability is the second reference implementation of the SiteNexis Capability Framework. It provides a single, provider-agnostic interface for all HTML fetching, parsing, and structured data extraction across the platform.

Before this implementation, extraction logic was duplicated across `apps/web/src/lib/serverless-audit.ts` (serverless path) and `packages/crawler/src/crawler.ts` (worker path), with different field names and different schema normalization. WebExtractionCapability consolidates both paths into one interface producing the canonical `CrawledPage` type from `@sitenexis/shared`.

**The rule it enforces:** business logic receives `CrawledPage` objects — it never touches HTML, Cheerio, Puppeteer, or fetch wrappers directly.

---

## Interface Summary

```typescript
// Every extraction provider implements this
interface WebExtractionAdapter {
  readonly provider: string;
  isConfigured(): boolean;

  // Extract a single URL — always available
  extractPage(url: string, opts?: ExtractionOptions): Promise<ExtractionOutput>;

  // Discover and crawl all pages on a domain
  crawlDomain(domain: string, opts?: DomainCrawlOptions): Promise<CrawledPage[]>;

  healthCheck(): Promise<ExtractionAdapterHealth>;
}

// Normalized output — same structure for every provider
interface ExtractionOutput {
  page: CrawledPage;        // canonical shared type from @sitenexis/shared
  metrics: ExtractionMetrics;
}
```

The output type is always `CrawledPage` from `@sitenexis/shared`. Provider-specific response shapes are erased inside the adapter.

---

## Adapters

| Name | `provider` string | Runtime | Notes |
|---|---|---|---|
| FetchExtractionAdapter | `fetch` | Any (serverless, edge, worker) | Native `fetch` + regex parsing; no runtime dependencies |
| PuppeteerExtractionAdapter | `puppeteer` | Worker process only | Wraps `DomainCrawler`; JavaScript-rendered pages |

### FetchExtractionAdapter

Serverless-compatible. Uses native `fetch` and regex-based HTML parsing — no Puppeteer, no Cheerio, no Redis. This is the extraction path for Vercel deployments and the `runServerlessAudit()` function.

Import: `import { getFetchExtractionAdapter } from '@sitenexis/adapters'`

### PuppeteerExtractionAdapter

Full JavaScript rendering via Puppeteer. Wraps `DomainCrawler` from `packages/crawler`. Only safe in the BullMQ worker process — will throw at import time on Vercel serverless.

Import: `import { PuppeteerExtractionAdapter } from '@sitenexis/crawler/puppeteer-adapter'`

---

## Security Controls

All adapters enforce URL safety before making any network request via `validateExtractionUrl()` in `packages/adapters/src/web-extraction/security.ts`.

**Blocked:**
- Private IP ranges: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`
- Loopback: `127.x.x.x`, `::1`
- Link-local: `169.254.x.x`, `fe80::`
- Internal hostnames: `localhost`, `metadata.google.internal`, `169.254.169.254`
- Non-HTTP/HTTPS schemes: `ftp://`, `file://`, `data:`, etc.

Blocked URLs throw `URLValidationError` before any network call is made.

---

## Metrics Emitted

Every `extractPage()` call returns an `ExtractionMetrics` object alongside the page:

```typescript
interface ExtractionMetrics {
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
  errorCode?: string;       // present on failure
  auditId?: string;         // from opts.ctx.auditId if provided
  traceId?: string;         // from opts.ctx.traceId if provided
}
```

---

## CrawledPage Fields

`CrawledPage` is the canonical output type defined in `packages/shared/src/types.ts`. Three convenience fields were added to support the extraction layer:

| Field | Type | Notes |
|---|---|---|
| `schemaTypes` | `string[]` | `@type` values extracted from all JSON-LD blocks |
| `hasStructuredData` | `boolean` | `true` if `schemaMarkup` is non-empty |
| `openGraph` | `{ title?, description?, image?, type? }` | Open Graph metadata |

These are optional on `CrawledPage` but guaranteed non-null by both adapters.

---

## Registry

`WebExtractionRegistry` provides a two-tier fallback chain (same pattern as `AIInferenceRegistry`):

```typescript
import { webRegistry, getFetchExtractionAdapter } from '@sitenexis/adapters';
import { PuppeteerExtractionAdapter } from '@sitenexis/crawler/puppeteer-adapter';

// Register in worker process at startup
webRegistry.register('puppeteer', 'primary', new PuppeteerExtractionAdapter());
webRegistry.register('fetch', 'fallback', getFetchExtractionAdapter());

// Use via registry (automatic fallback)
const pages = await webRegistry.crawlDomain(domain, { maxPages: 50, ctx: { auditId } });
```

If the registry is empty, `extractPage()` and `crawlDomain()` fall back directly to `getFetchExtractionAdapter()` for backward compatibility.

---

## Example Usage

### Serverless audit path

```typescript
import { getFetchExtractionAdapter } from '@sitenexis/adapters';

const extractor = getFetchExtractionAdapter();
const pages = await extractor.crawlDomain(domain, {
  maxPages: 50,
  concurrency: 4,
  timeoutMs: 12_000,
  ctx: { auditId, domain },
  onPage: (page) => {
    // streaming progress callback
  },
});
```

### Single-page extraction with metrics

```typescript
import { getFetchExtractionAdapter } from '@sitenexis/adapters';

const { page, metrics } = await getFetchExtractionAdapter().extractPage(url, {
  timeoutMs: 10_000,
  ctx: { auditId, traceId },
});

logger.info(metrics, 'page-extracted');
// page.schemaTypes, page.hasStructuredData, page.openGraph available
```

### Worker process (Puppeteer)

```typescript
import { PuppeteerExtractionAdapter } from '@sitenexis/crawler/puppeteer-adapter';

const adapter = new PuppeteerExtractionAdapter();
const pages = await adapter.crawlDomain(domain, {
  maxPages: 500,
  concurrency: 5,
  ctx: { auditId },
  onPage: (page) => crawler.emit('page:crawled', page),
});
```

---

## ParsedPage Migration

`serverless-audit.ts` previously defined a local `ParsedPage` interface with field names that diverged from `CrawledPage`:

| Old `ParsedPage` field | New `CrawledPage` field |
|---|---|
| `canonical` | `canonicalUrl` |
| `robotsMeta` | `robotsDirectives[0]` |
| `schemas` | `schemaMarkup` |

`ParsedPage` is now defined in `serverless-audit.ts` as a local alias that extends `CrawledPage` with backward-compat accessors. The `toParsedPage(page: CrawledPage)` helper maps between them. This alias should be removed in a future cleanup pass once all callers inside `serverless-audit.ts` are updated to use `CrawledPage` field names directly.

---

## Known Limitations

1. **FetchExtractionAdapter does not render JavaScript.** Pages that load content via client-side React, Vue, or Next.js hydration will return reduced body text. Use `PuppeteerExtractionAdapter` for JS-rendered pages in the worker.
2. **Redirect chain tracking not implemented.** `CrawledPage.redirectChain` is always `[]` in `FetchExtractionAdapter` — native `fetch` with `redirect: 'follow'` does not expose the intermediate URLs.
3. **robots.txt not enforced in FetchExtractionAdapter.** The `DomainCrawlOptions.respectRobotsTxt` flag is defined but not yet evaluated. Robots.txt enforcement is implemented in `DomainCrawler` (Puppeteer path).
4. **Image extraction not implemented in FetchExtractionAdapter.** `CrawledPage.images` is always `[]`. Images are extracted by `DomainCrawler` via Cheerio in the worker path.
5. **`crawlDomain()` does not coordinate de-duplication across parallel batches.** URLs that appear in both the sitemap and the homepage link list may be fetched twice.
6. **No retry logic.** Failed pages (network errors, 5xx) are silently skipped. Callers that require retry must implement it at the call site.

---

## How to Add a New Extraction Provider

1. Create `packages/adapters/src/web-extraction/[provider].adapter.ts` implementing `WebExtractionAdapter`.
2. `isConfigured()` must return false when credentials or runtime prerequisites are absent — never throw.
3. `extractPage()` must call `validateExtractionUrl(url)` before making any network request.
4. `extractPage()` must return a valid `ExtractionOutput` even on failure — never throw for network errors; return `{ page: emptyPage, metrics: { success: false, ... } }`.
5. `crawlDomain()` may throw for unrecoverable errors (e.g., domain unreachable) — the registry catches and falls back.
6. All output must normalize to `CrawledPage` — erase provider-specific response shapes.
7. Export a factory function: `getMyProviderAdapter()` (env key) or `makeMyProviderAdapter(apiKey)` (caller-supplied key).
8. Add exports to `packages/adapters/src/web-extraction/index.ts`.
9. Write unit tests in `__tests__/[provider].adapter.test.ts` covering: success, broken page, SSRF block, health check.

---

## Files Changed

### New files

| File | Purpose |
|---|---|
| `packages/adapters/src/web-extraction/interface.ts` | Canonical types for all extraction adapters |
| `packages/adapters/src/web-extraction/security.ts` | URL validation + SSRF IP blocklist |
| `packages/adapters/src/web-extraction/fetch.adapter.ts` | FetchExtractionAdapter: serverless-compatible |
| `packages/adapters/src/web-extraction/registry.ts` | WebExtractionRegistry with fallback chain |
| `packages/adapters/src/web-extraction/index.ts` | Barrel exports |
| `packages/adapters/src/web-extraction/__tests__/fetch.adapter.test.ts` | 18 unit tests |
| `packages/adapters/src/web-extraction/__tests__/fixtures/static.html` | Full-featured page fixture |
| `packages/adapters/src/web-extraction/__tests__/fixtures/schema-rich.html` | Multi-schema fixture (HowTo + FAQPage) |
| `packages/adapters/src/web-extraction/__tests__/fixtures/minimal.html` | Thin page fixture |
| `packages/adapters/src/web-extraction/__tests__/fixtures/broken-fields.html` | Missing fields + invalid JSON-LD |
| `packages/crawler/src/puppeteer.adapter.ts` | PuppeteerExtractionAdapter: worker process only |
| `docs/capabilities/web-extraction.md` | This document |

### Modified files

| File | Change |
|---|---|
| `packages/adapters/src/index.ts` | Added `export * from './web-extraction/index'` |
| `packages/crawler/package.json` | Added `@sitenexis/adapters: workspace:*` dep; added `./puppeteer-adapter` export entry |
| `packages/shared/src/types.ts` | Added `schemaTypes?`, `hasStructuredData?`, `openGraph?` to `CrawledPage` |
| `apps/web/src/lib/serverless-audit.ts` | Replaced `ParsedPage`/`parseHtml`/`fetchPage`/`fetchSitemapUrls` with `getFetchExtractionAdapter().crawlDomain()` |
