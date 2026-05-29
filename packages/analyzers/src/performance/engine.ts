import {
  type CrawledPage,
  type PerformanceScore,
  type PerformanceResult,
  type CoreWebVitals,
  type PerformanceOpportunity,
  type SEOIssueSeverity,
} from '@sitenexis/shared';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const LCP_CRITICAL = 4.0;   // seconds
const LCP_WARNING  = 2.5;
const CLS_CRITICAL = 0.25;
const CLS_WARNING  = 0.10;
const TBT_CRITICAL = 600;   // ms
const TBT_WARNING  = 200;

const MAX_PAGES    = 5;
const TIMEOUT_MS   = 60_000;

// ─── Lighthouse type stubs (graceful when package absent) ────────────────────

interface LHAudit {
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: {
    type?: string;
    items?: Array<Record<string, unknown>>;
  };
}

interface LHResult {
  categories: {
    performance?: { score: number | null };
  };
  audits: Record<string, LHAudit>;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run Lighthouse-based performance analysis on a sample of pages.
 *
 * Lighthouse is an optional dependency — if unavailable or if a page audit
 * fails, a graceful skip result is returned. Never throws.
 *
 * @param pages     - Full crawl result.
 * @param inDegree  - Optional inDegree map from the link-graph engine, used to
 *                    select the 4 highest-traffic pages after the homepage.
 */
export async function analyzePerformance(
  pages: CrawledPage[],
  inDegree: Map<string, number> = new Map()
): Promise<PerformanceScore> {
  if (pages.length === 0) {
    return emptyScore();
  }

  // ── Select sample: homepage + up to 4 highest-inDegree pages ──────────────
  const sample = selectSample(pages, inDegree);

  // ── Check whether Lighthouse is available ─────────────────────────────────
  const lighthouse = await tryLoadLighthouse();

  // ── Analyse each page ─────────────────────────────────────────────────────
  const pageResults: PerformanceResult[] = [];

  for (const page of sample) {
    if (lighthouse) {
      const result = await runLighthouse(page.url, lighthouse);
      pageResults.push(result);
    } else {
      // Lighthouse unavailable — fall back to response-time heuristics
      pageResults.push(heuristicResult(page));
    }
  }

  return aggregateScore(pageResults, pages);
}

// ─── Page selection ───────────────────────────────────────────────────────────

function selectSample(
  pages: CrawledPage[],
  inDegree: Map<string, number>
): CrawledPage[] {
  const sorted = [...pages].sort((a, b) => {
    const aInd = inDegree.get(a.url) ?? 0;
    const bInd = inDegree.get(b.url) ?? 0;
    return bInd - aInd;
  });

  // Homepage first (shortest URL or path === "/")
  const homepageIdx = sorted.findIndex((p) => {
    try {
      const u = new URL(p.url);
      return u.pathname === '/' || u.pathname === '';
    } catch {
      return false;
    }
  });

  const sample: CrawledPage[] = [];
  if (homepageIdx !== -1) {
    sample.push(sorted[homepageIdx]!);
    sorted.splice(homepageIdx, 1);
  }

  for (const p of sorted) {
    if (sample.length >= MAX_PAGES) break;
    sample.push(p);
  }

  return sample;
}

// ─── Lighthouse loader ────────────────────────────────────────────────────────

async function tryLoadLighthouse(): Promise<
  ((url: string, opts: Record<string, unknown>) => Promise<{ lhr: LHResult }>) | null
> {
  try {
    // Dynamic import so the module compiles even when lighthouse is not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('lighthouse' as any) as unknown as {
      default?: (url: string, opts: Record<string, unknown>) => Promise<{ lhr: LHResult }>;
      (url: string, opts: Record<string, unknown>): Promise<{ lhr: LHResult }>;
    };
    return mod.default ?? (mod as unknown as (url: string, opts: Record<string, unknown>) => Promise<{ lhr: LHResult }>);
  } catch {
    return null;
  }
}

// ─── Lighthouse runner ────────────────────────────────────────────────────────

async function runLighthouse(
  url: string,
  lighthouse: (url: string, opts: Record<string, unknown>) => Promise<{ lhr: LHResult }>
): Promise<PerformanceResult> {
  // Desktop run
  const desktopPromise = withTimeout(
    lighthouse(url, {
      onlyCategories: ['performance'],
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
      throttling: { rttMs: 40, throughputKbps: 10_240, cpuSlowdownMultiplier: 1 },
      output: 'json',
      logLevel: 'silent',
    }),
    TIMEOUT_MS
  );

  // Mobile run
  const mobilePromise = withTimeout(
    lighthouse(url, {
      onlyCategories: ['performance'],
      formFactor: 'mobile',
      output: 'json',
      logLevel: 'silent',
    }),
    TIMEOUT_MS
  );

  let desktopLhr: LHResult | null = null;
  let mobileLhr: LHResult | null = null;
  let skipReason: string | undefined;

  try {
    const [desktop, mobile] = await Promise.allSettled([desktopPromise, mobilePromise]);
    if (desktop.status === 'fulfilled') desktopLhr = desktop.value.lhr;
    if (mobile.status === 'fulfilled') mobileLhr = mobile.value.lhr;
    if (!desktopLhr && !mobileLhr) {
      skipReason = 'Lighthouse audit timed out or failed on both runs';
    }
  } catch (err) {
    skipReason = `Lighthouse error: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (!desktopLhr && skipReason) {
    return skipResult(url, skipReason);
  }

  return extractResult(url, desktopLhr, mobileLhr);
}

// ─── Result extraction ────────────────────────────────────────────────────────

function extractResult(
  url: string,
  desktop: LHResult | null,
  mobile: LHResult | null
): PerformanceResult {
  const lhr = desktop ?? mobile!;

  const lhScore = scoreFromLhr(lhr);
  const mobileLhScore = mobile ? scoreFromLhr(mobile) : null;

  const lcp   = numericAudit(lhr, 'largest-contentful-paint', 1000); // convert ms → s
  const cls   = numericAudit(lhr, 'cumulative-layout-shift');
  const inp   = numericAudit(lhr, 'interaction-to-next-paint');
  const tbt   = numericAudit(lhr, 'total-blocking-time');

  const vitals: CoreWebVitals = { lcp, cls, inp, tbt };

  const issues = buildIssues(url, vitals);
  const opportunities = extractOpportunities(lhr);

  const passed =
    issues.filter((i) => i.severity === 'critical').length === 0 &&
    (lhScore ?? 0) >= 50;

  return {
    url,
    lighthouseScore: lhScore,
    mobileLighthouseScore: mobileLhScore,
    coreWebVitals: vitals,
    passed,
    skipped: false,
    issues,
    opportunities,
  };
}

function scoreFromLhr(lhr: LHResult): number | null {
  const s = lhr.categories.performance?.score;
  return s != null ? Math.round(s * 100) : null;
}

function numericAudit(lhr: LHResult, key: string, divisor = 1): number | null {
  const audit = lhr.audits[key];
  if (!audit || audit.numericValue == null) return null;
  return audit.numericValue / divisor;
}

function extractOpportunities(lhr: LHResult): PerformanceOpportunity[] {
  const OPPORTUNITY_KEYS = [
    'render-blocking-resources',
    'unused-javascript',
    'unused-css-rules',
    'uses-optimized-images',
    'uses-webp-images',
    'uses-text-compression',
    'efficient-animated-content',
    'uses-long-cache-ttl',
  ];

  const results: PerformanceOpportunity[] = [];
  for (const key of OPPORTUNITY_KEYS) {
    const audit = lhr.audits[key];
    if (!audit || audit.score == null || audit.score >= 0.9) continue;
    const savingMs =
      (audit.details?.items as Array<{ wastedMs?: number }> | undefined)
        ?.reduce((sum, item) => sum + (item.wastedMs ?? 0), 0) ?? 0;
    results.push({ title: audit.displayValue ?? key, estimatedSavingMs: Math.round(savingMs) });
  }
  return results;
}

// ─── Issue builder ────────────────────────────────────────────────────────────

function buildIssues(
  url: string,
  vitals: CoreWebVitals
): PerformanceResult['issues'] {
  const issues: PerformanceResult['issues'] = [];

  if (vitals.lcp != null) {
    if (vitals.lcp > LCP_CRITICAL) {
      issues.push(issue('critical', url,
        `LCP is ${vitals.lcp.toFixed(1)}s — significantly above the 2.5s threshold`,
        'Reduce LCP by optimising the largest image or text block: preload hero images, use a CDN, apply lazy loading only to below-fold content.'));
    } else if (vitals.lcp > LCP_WARNING) {
      issues.push(issue('warning', url,
        `LCP is ${vitals.lcp.toFixed(1)}s — above the 2.5s good threshold`,
        'Improve LCP by compressing and preloading the hero image or largest text element.'));
    }
  }

  if (vitals.cls != null) {
    if (vitals.cls > CLS_CRITICAL) {
      issues.push(issue('critical', url,
        `CLS is ${vitals.cls.toFixed(3)} — layout shifts are severely impacting UX and AI readability`,
        'Fix CLS by specifying width/height on images and embeds, avoiding dynamically injected content above the fold.'));
    } else if (vitals.cls > CLS_WARNING) {
      issues.push(issue('warning', url,
        `CLS is ${vitals.cls.toFixed(3)} — above the 0.1 good threshold`,
        'Reserve space for images, ads, and embeds to reduce unexpected layout shifts.'));
    }
  }

  if (vitals.tbt != null) {
    if (vitals.tbt > TBT_CRITICAL) {
      issues.push(issue('critical', url,
        `TBT is ${Math.round(vitals.tbt)}ms — long tasks are blocking the main thread`,
        'Split large JavaScript bundles, defer non-critical scripts, and eliminate render-blocking resources.'));
    } else if (vitals.tbt > TBT_WARNING) {
      issues.push(issue('warning', url,
        `TBT is ${Math.round(vitals.tbt)}ms — main thread is partially blocked`,
        'Audit and defer third-party scripts, use code splitting to reduce initial JS execution time.'));
    }
  }

  return issues;
}

function issue(
  severity: SEOIssueSeverity,
  url: string,
  message: string,
  recommendation: string
): PerformanceResult['issues'][number] {
  return { severity, url, message, recommendation };
}

// ─── Heuristic fallback (no Lighthouse) ──────────────────────────────────────

function heuristicResult(page: CrawledPage): PerformanceResult {
  const ttfbMs = page.responseTimeMs;
  const issues: PerformanceResult['issues'] = [];

  if (ttfbMs > 4000) {
    issues.push(issue('critical', page.url,
      `Server response time is ${ttfbMs}ms — TTFB is critically slow`,
      'Optimise server-side rendering, enable caching, and use a CDN to reduce TTFB below 800ms.'));
  } else if (ttfbMs > 2000) {
    issues.push(issue('warning', page.url,
      `Server response time is ${ttfbMs}ms — TTFB is above 800ms target`,
      'Check for slow database queries, unoptimised server logic, or missing caching headers.'));
  }

  if (page.redirectChain.length > 0) {
    issues.push(issue('info', page.url,
      `Redirect chain adds latency (${page.redirectChain.length} hop${page.redirectChain.length === 1 ? '' : 's'})`,
      'Update internal links and canonical URLs to point directly to the final destination URL.'));
  }

  // Heuristic score: start at 100, deduct for slow TTFB + redirects
  let score = 100;
  if (ttfbMs > 4000) score -= 40;
  else if (ttfbMs > 2000) score -= 25;
  else if (ttfbMs > 800) score -= 10;
  if (page.redirectChain.length > 0) score -= page.redirectChain.length * 5;

  return {
    url: page.url,
    lighthouseScore: Math.max(0, score),
    mobileLighthouseScore: null,
    coreWebVitals: { lcp: null, cls: null, inp: null, tbt: null },
    passed: score >= 70 && issues.every((i) => i.severity !== 'critical'),
    skipped: false,
    issues,
    opportunities: [],
  };
}

// ─── Skip result ──────────────────────────────────────────────────────────────

function skipResult(url: string, reason: string): PerformanceResult {
  return {
    url,
    lighthouseScore: null,
    mobileLighthouseScore: null,
    coreWebVitals: { lcp: null, cls: null, inp: null, tbt: null },
    passed: false,
    skipped: true,
    skipReason: reason,
    issues: [],
    opportunities: [],
  };
}

// ─── Score aggregation ────────────────────────────────────────────────────────

function aggregateScore(
  pageResults: PerformanceResult[],
  allPages: CrawledPage[]
): PerformanceScore {
  // TTFB heuristic from all crawled pages (complements Lighthouse sample)
  const avgResponseMs =
    allPages.reduce((sum, p) => sum + p.responseTimeMs, 0) / allPages.length;

  const ttfbIssues: PerformanceScore['issues'] = [];
  for (const page of allPages.filter((p) => p.responseTimeMs > 2000).slice(0, 10)) {
    ttfbIssues.push(issue(
      page.responseTimeMs > 4000 ? 'critical' : 'warning',
      page.url,
      `Slow server response: ${page.responseTimeMs}ms`,
      'Optimise server response time to under 800ms. Check caching, database queries, and CDN configuration.'
    ));
  }

  // Aggregate Lighthouse scores from non-skipped results
  const scored = pageResults.filter((r) => !r.skipped && r.lighthouseScore != null);
  const avgLighthouseScore = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + r.lighthouseScore!, 0) / scored.length)
    : null;

  // Aggregate CWV — use medians from sampled pages
  const lcpValues  = scored.map((r) => r.coreWebVitals.lcp).filter((v): v is number => v != null);
  const clsValues  = scored.map((r) => r.coreWebVitals.cls).filter((v): v is number => v != null);

  const medianLcp = median(lcpValues);
  const medianCls = median(clsValues);

  // All issues across sampled pages + TTFB issues
  const allIssues = [
    ...pageResults.flatMap((r) => r.issues),
    ...ttfbIssues,
  ];

  // Site score: Lighthouse average if available, otherwise TTFB heuristic
  let score: number;
  if (avgLighthouseScore != null) {
    score = avgLighthouseScore;
    // Blend with TTFB heuristic (10% weight)
    const ttfbScore = ttfbHeuristicScore(avgResponseMs);
    score = Math.round(score * 0.9 + ttfbScore * 0.1);
  } else {
    score = ttfbHeuristicScore(avgResponseMs);
    score -= Math.min(30, allIssues.filter((i) => i.severity === 'critical').length * 8);
    score -= Math.min(20, allIssues.filter((i) => i.severity === 'warning').length * 3);
    score = Math.max(0, score);
  }

  return {
    score: Math.min(100, score),
    lighthouseScore: avgLighthouseScore,
    lcp: medianLcp,
    fid: null,  // FID is deprecated in favour of INP — kept for type compat
    cls: medianCls,
    ttfb: Math.round(avgResponseMs),
    pageResults,
    issues: allIssues,
  };
}

function emptyScore(): PerformanceScore {
  return {
    score: 0,
    lighthouseScore: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    pageResults: [],
    issues: [],
  };
}

function ttfbHeuristicScore(avgResponseMs: number): number {
  if (avgResponseMs > 4000) return 55;
  if (avgResponseMs > 2000) return 70;
  if (avgResponseMs > 800)  return 85;
  return 100;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err as Error); }
    );
  });
}
