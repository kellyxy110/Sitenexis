/**
 * Quick Machine Trust Score
 * Public, no-auth, single-domain crawl that produces a 4-dimension MTS estimate.
 * Called directly by server components and by /api/mts for external access.
 */
import { isPrivateHostUrl, fetchNoInternalRedirects } from './safe-fetch';

export type MTSGrade = 'Authoritative' | 'Established' | 'Developing' | 'Unverified';

export type MTSSignal = {
  dimension: 'crawlability' | 'content_trust' | 'entity_clarity' | 'citation_readiness';
  label: string;
  ok: boolean;
  partial?: boolean;
  detail: string;
};

export type QuickMTSResult = {
  domain: string;
  url: string;
  quickMTS: number;
  grade: MTSGrade;
  subScores: {
    crawlability: number;
    contentTrust: number;
    entityClarity: number;
    citationReadiness: number;
  };
  signals: MTSSignal[];
  schemaTypes: string[];
  ttfbMs: number;
  wordCount: number;
  isHttps: boolean;
  cachedAt: string;
  error?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function normaliseUrl(input: string): string {
  const raw = input.trim().replace(/\/+$/, '');
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://${raw}`;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function stripAndCount(html: string): number {
  const noScript = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  return noScript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
}

function extractJsonLdTypes(html: string): string[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return [...new Set(
    blocks.flatMap((b) => [...(b[1] ?? '').matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1] ?? ''))
  )];
}

const TRUSTED_DOMAINS = /\.(gov|edu|ac\.uk|wikipedia\.org|reuters\.com|bbc\.co\.uk|bloomberg\.com)/i;
const AI_CRAWLERS = ['gptbot', 'chatgpt-user', 'google-extended', 'anthropic-ai', 'claudebot', 'perplexitybot', 'ccbot'];

// ── Main scorer ────────────────────────────────────────────────────────────────

export async function computeQuickMTS(rawInput: string): Promise<QuickMTSResult> {
  const url = normaliseUrl(rawInput);
  const domain = extractDomain(url);
  const isHttps = url.startsWith('https://');
  const signals: MTSSignal[] = [];

  if (isPrivateHostUrl(url)) {
    return {
      domain, url, quickMTS: 0, grade: 'Unverified',
      subScores: { crawlability: 0, contentTrust: 0, entityClarity: 0, citationReadiness: 0 },
      signals: [{ dimension: 'crawlability', label: 'Domain reachable', ok: false, detail: 'Private or reserved addresses are not allowed' }],
      schemaTypes: [], ttfbMs: 0, wordCount: 0, isHttps, cachedAt: new Date().toISOString(),
      error: 'Private or reserved addresses are not allowed',
    };
  }

  // ── Fetch homepage ────────────────────────────────────────────────────────
  let html = '';
  let ttfbMs = 0;
  let httpStatus = 0;
  let finalUrl = url;

  try {
    const t0 = Date.now();
    const res = await fetchNoInternalRedirects(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        'User-Agent': `SiteNexis-MTS/1.0 (+${process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app'}/mts)`,
        Accept: 'text/html',
      },
    });
    ttfbMs = Date.now() - t0;
    httpStatus = res.status;
    finalUrl = res.url;
    html = await res.text();
  } catch (err) {
    return {
      domain, url, quickMTS: 0, grade: 'Unverified',
      subScores: { crawlability: 0, contentTrust: 0, entityClarity: 0, citationReadiness: 0 },
      signals: [{ dimension: 'crawlability', label: 'Domain reachable', ok: false, detail: err instanceof Error ? err.message : 'Fetch failed' }],
      schemaTypes: [], ttfbMs: 0, wordCount: 0, isHttps, cachedAt: new Date().toISOString(),
      error: 'Could not reach domain',
    };
  }

  if (httpStatus >= 400) {
    return {
      domain, url, quickMTS: 0, grade: 'Unverified',
      subScores: { crawlability: 0, contentTrust: 0, entityClarity: 0, citationReadiness: 0 },
      signals: [{ dimension: 'crawlability', label: 'Domain reachable', ok: false, detail: `HTTP ${httpStatus}` }],
      schemaTypes: [], ttfbMs, wordCount: 0, isHttps, cachedAt: new Date().toISOString(),
      error: `HTTP ${httpStatus}`,
    };
  }

  // ── Parse homepage ────────────────────────────────────────────────────────
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const metaDesc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']*)[^>]+name=["']description["']/i)?.[1]?.trim() ?? '';
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    (m[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const h2Count = (html.match(/<h2[^>]*>/gi) ?? []).length;
  const isNoindex = /noindex/i.test(html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i)?.[1] ?? '');
  const canonicalHref =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)[^>]+rel=["']canonical["']/i)?.[1] ?? '';
  const schemaTypes = extractJsonLdTypes(html);
  const wordCount = stripAndCount(html);

  // sameAs extraction from JSON-LD
  const sameAsMatches = [...html.matchAll(/"sameAs"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g)];
  const hasSameAs = sameAsMatches.length > 0;
  const hasOrganisationSchema = schemaTypes.some((t) => ['Organization', 'LocalBusiness', 'Corporation', 'NGO', 'EducationalOrganization'].includes(t));
  const hasPersonSchema = schemaTypes.some((t) => t === 'Person');
  const hasFaqSchema = schemaTypes.some((t) => t === 'FAQPage');
  const hasArticleSchema = schemaTypes.some((t) => ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle'].includes(t));
  const hasHowToSchema = schemaTypes.some((t) => t === 'HowTo');
  const hasAuthorSchema = /"author"\s*:\s*\{/.test(html);

  // External links to trusted domains
  const externalLinks = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1] ?? '');
  const trustedLinkCount = externalLinks.filter((l) => TRUSTED_DOMAINS.test(l)).length;

  // ── Fetch robots.txt ──────────────────────────────────────────────────────
  let robotsTxt = '';
  let robotsOk = false;
  try {
    const r = await fetchNoInternalRedirects(`${url.replace(/\/+$/, '')}/robots.txt`, {
      signal: AbortSignal.timeout(5_000),
      headers: { 'User-Agent': 'SiteNexis-MTS/1.0' },
    });
    if (r.ok) { robotsTxt = await r.text(); robotsOk = true; }
  } catch { /* non-fatal */ }

  const robotsLower = robotsTxt.toLowerCase();
  const aiCrawlersBlocked = AI_CRAWLERS.filter((bot) => {
    const idx = robotsLower.indexOf(`user-agent: ${bot}`);
    if (idx === -1) return false;
    const disallowIdx = robotsLower.indexOf('disallow: /', idx);
    const nextUserAgent = robotsLower.indexOf('user-agent:', idx + 1);
    return disallowIdx !== -1 && (nextUserAgent === -1 || disallowIdx < nextUserAgent);
  });
  const aiCrawlersAllowed = aiCrawlersBlocked.length === 0;

  // ── Fetch sitemap ─────────────────────────────────────────────────────────
  let sitemapOk = false;
  try {
    const sitemapUrl =
      robotsTxt.match(/sitemap:\s*(\S+)/i)?.[1] ??
      `${url.replace(/\/+$/, '')}/sitemap.xml`;
    // sitemapUrl can come from the target's own robots.txt content — validate it
    // too, since that text is attacker-influenced even when the domain itself isn't.
    if (!isPrivateHostUrl(sitemapUrl)) {
      const s = await fetchNoInternalRedirects(sitemapUrl, { signal: AbortSignal.timeout(5_000) });
      sitemapOk = s.ok;
    }
  } catch { /* non-fatal */ }

  // ── DIMENSION 1: Crawlability (20% weight) ────────────────────────────────
  let crawlability = 0;

  signals.push({ dimension: 'crawlability', label: 'HTTPS', ok: isHttps, detail: isHttps ? 'Served over HTTPS' : 'HTTP only — trust signal missing' });
  if (isHttps) crawlability += 20;

  signals.push({ dimension: 'crawlability', label: 'robots.txt accessible', ok: robotsOk, detail: robotsOk ? 'robots.txt returns 200' : 'robots.txt not found or unreachable' });
  if (robotsOk) crawlability += 15;

  signals.push({ dimension: 'crawlability', label: 'AI crawlers permitted', ok: aiCrawlersAllowed, detail: aiCrawlersAllowed ? 'No AI crawler blocks detected' : `Blocked: ${aiCrawlersBlocked.join(', ')}` });
  if (aiCrawlersAllowed) crawlability += 25;

  signals.push({ dimension: 'crawlability', label: 'XML sitemap', ok: sitemapOk, detail: sitemapOk ? 'sitemap.xml accessible' : 'No accessible sitemap found' });
  if (sitemapOk) crawlability += 15;

  signals.push({ dimension: 'crawlability', label: 'Fast response (TTFB)', ok: ttfbMs < 600, partial: ttfbMs < 1200, detail: `${ttfbMs}ms TTFB${ttfbMs < 600 ? ' — excellent' : ttfbMs < 1200 ? ' — acceptable' : ' — slow'}` });
  if (ttfbMs < 600) crawlability += 15; else if (ttfbMs < 1200) crawlability += 8;

  signals.push({ dimension: 'crawlability', label: 'Indexable (no noindex)', ok: !isNoindex, detail: isNoindex ? 'noindex directive found — invisible to AI crawlers' : 'Page is indexable' });
  if (!isNoindex) crawlability += 10;

  // ── DIMENSION 2: Content Trust (30% weight) ───────────────────────────────
  let contentTrust = 0;

  const titleOk = title.length >= 30 && title.length <= 70;
  signals.push({ dimension: 'content_trust', label: 'Title tag', ok: !!title, partial: !!title && !titleOk, detail: title ? `"${title.slice(0, 55)}${title.length > 55 ? '…' : ''}" (${title.length} chars)` : 'Missing <title> tag' });
  if (titleOk) contentTrust += 15; else if (title) contentTrust += 8;

  const metaOk = metaDesc.length >= 100 && metaDesc.length <= 165;
  signals.push({ dimension: 'content_trust', label: 'Meta description', ok: !!metaDesc, partial: !!metaDesc && !metaOk, detail: metaDesc ? `${metaDesc.length} chars` : 'Missing meta description' });
  if (metaOk) contentTrust += 15; else if (metaDesc) contentTrust += 8;

  const h1Ok = h1s.length === 1;
  signals.push({ dimension: 'content_trust', label: 'Single H1 heading', ok: h1Ok, detail: h1s.length === 0 ? 'No H1 found' : h1s.length === 1 ? `"${(h1s[0] ?? '').slice(0, 50)}"` : `${h1s.length} H1 tags found` });
  if (h1Ok) contentTrust += 20;

  signals.push({ dimension: 'content_trust', label: 'H2 subheadings', ok: h2Count >= 2, partial: h2Count === 1, detail: `${h2Count} H2 heading${h2Count !== 1 ? 's' : ''} found` });
  if (h2Count >= 2) contentTrust += 10; else if (h2Count === 1) contentTrust += 5;

  const wcOk = wordCount >= 500;
  signals.push({ dimension: 'content_trust', label: 'Content depth', ok: wcOk, partial: wordCount >= 200, detail: `~${wordCount} words${wcOk ? ' — sufficient depth' : wordCount >= 200 ? ' — borderline' : ' — thin content'}` });
  if (wcOk) contentTrust += 20; else if (wordCount >= 200) contentTrust += 10;

  signals.push({ dimension: 'content_trust', label: 'External trust references', ok: trustedLinkCount >= 2, partial: trustedLinkCount === 1, detail: trustedLinkCount > 0 ? `${trustedLinkCount} link${trustedLinkCount > 1 ? 's' : ''} to authoritative sources` : 'No links to .gov, .edu, or authoritative sources' });
  if (trustedLinkCount >= 2) contentTrust += 20; else if (trustedLinkCount === 1) contentTrust += 10;

  // ── DIMENSION 3: Entity Clarity (25% weight) ──────────────────────────────
  let entityClarity = 0;

  signals.push({ dimension: 'entity_clarity', label: 'Schema.org markup', ok: schemaTypes.length > 0, detail: schemaTypes.length > 0 ? `Types: ${[...new Set(schemaTypes)].join(', ')}` : 'No JSON-LD schema found' });
  if (schemaTypes.length > 0) entityClarity += 15;

  signals.push({ dimension: 'entity_clarity', label: 'Organisation or entity schema', ok: hasOrganisationSchema || hasPersonSchema, detail: hasOrganisationSchema ? 'Organization schema present' : hasPersonSchema ? 'Person schema present' : 'No entity-defining schema (Organization/Person)' });
  if (hasOrganisationSchema || hasPersonSchema) entityClarity += 30;

  signals.push({ dimension: 'entity_clarity', label: 'sameAs entity links', ok: hasSameAs, detail: hasSameAs ? 'sameAs links found — external entity validation signals present' : 'No sameAs links — entity cannot be cross-validated' });
  if (hasSameAs) entityClarity += 30;

  signals.push({ dimension: 'entity_clarity', label: 'Author schema', ok: hasAuthorSchema, detail: hasAuthorSchema ? 'Author defined in schema markup' : 'No author schema found' });
  if (hasAuthorSchema) entityClarity += 25;

  // ── DIMENSION 4: Citation Readiness (25% weight) ─────────────────────────
  let citationReadiness = 0;

  signals.push({ dimension: 'citation_readiness', label: 'Canonical URL configured', ok: !!canonicalHref, detail: canonicalHref ? `Canonical: ${canonicalHref.slice(0, 60)}` : 'No canonical tag — citation deduplication unavailable' });
  if (canonicalHref) citationReadiness += 20;

  signals.push({ dimension: 'citation_readiness', label: 'FAQPage schema', ok: hasFaqSchema, detail: hasFaqSchema ? 'FAQPage JSON-LD detected — strong citation signal' : 'No FAQPage schema — high-value citation signal missing' });
  if (hasFaqSchema) citationReadiness += 35;

  signals.push({ dimension: 'citation_readiness', label: 'Article or content schema', ok: hasArticleSchema, detail: hasArticleSchema ? 'Article/BlogPosting schema present' : 'No Article schema — content type unclear to AI systems' });
  if (hasArticleSchema) citationReadiness += 25;

  signals.push({ dimension: 'citation_readiness', label: 'HowTo or structured process', ok: hasHowToSchema, detail: hasHowToSchema ? 'HowTo schema present — procedural citation signal' : 'No HowTo schema' });
  if (hasHowToSchema) citationReadiness += 20;

  // ── Composite score ───────────────────────────────────────────────────────
  const quickMTS = Math.round(
    crawlability * 0.20 +
    contentTrust * 0.30 +
    entityClarity * 0.25 +
    citationReadiness * 0.25
  );

  const grade: MTSGrade =
    quickMTS >= 75 ? 'Authoritative' :
    quickMTS >= 55 ? 'Established' :
    quickMTS >= 35 ? 'Developing' :
    'Unverified';

  return {
    domain: extractDomain(finalUrl),
    url: finalUrl,
    quickMTS,
    grade,
    subScores: { crawlability, contentTrust, entityClarity, citationReadiness },
    signals,
    schemaTypes: [...new Set(schemaTypes)],
    ttfbMs,
    wordCount,
    isHttps,
    cachedAt: new Date().toISOString(),
  };
}

export function gradeColor(grade: MTSGrade): string {
  return grade === 'Authoritative' ? '#22C55E' :
         grade === 'Established'   ? '#0BCEBC' :
         grade === 'Developing'    ? '#F59E0B' :
         '#EF4444';
}
