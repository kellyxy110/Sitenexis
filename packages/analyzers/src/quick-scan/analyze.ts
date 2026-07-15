/**
 * Quick-scan: single-page HTML analysis for the unauthenticated `/api/quick-audit`
 * endpoint. Pure and dependency-free so it is unit-testable and cannot hang.
 *
 * Robustness rules (a heavy or hostile page must never make the handler run
 * unbounded — the Mayo-class "no site fails silently" guarantee):
 *   1. Input is hard-capped at MAX_QUICK_SCAN_HTML bytes before any regex runs, so
 *      CPU/memory stay bounded regardless of page size.
 *   2. Script/style stripping uses a linear indexOf scanner, never a backtracking
 *      regex, so pathological markup cannot trigger super-linear blowup.
 */

export const MAX_QUICK_SCAN_HTML = 2_000_000; // 2 MB — covers head + substantial body of any real page

export interface QuickScanIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendation?: string;
}

export interface QuickScanResult {
  quickScore: number;
  title: string;
  metaDescription: string;
  h1s: string[];
  schemaTypes: string[];
  wordCount: number;
  canonical: string | null;
  isNoindex: boolean;
  isLikelyJsRendered: boolean;
  truncated: boolean;
  issues: QuickScanIssue[];
  summary: { critical: number; warnings: number; info: number };
}

/**
 * Remove the contents of a paired tag (`script`/`style`) in a single linear pass.
 * O(n) via indexOf — immune to the catastrophic backtracking that a nested-quantifier
 * regex can hit on large minified bundles.
 */
export function stripPairedTag(input: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const lower = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < input.length) {
    const start = lower.indexOf(open, i);
    if (start === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, start);
    const gt = lower.indexOf('>', start);
    if (gt === -1) break; // malformed open tag — drop the rest
    const end = lower.indexOf(close, gt + 1);
    if (end === -1) break; // unterminated tag — drop the rest (bounded)
    i = end + close.length;
  }
  return out;
}

export function stripScriptsAndStyles(html: string): string {
  return stripPairedTag(stripPairedTag(html, 'script'), 'style');
}

/**
 * Analyse a single page's raw HTML into a quick-scan result. Never throws on
 * adversarial input; always bounded.
 */
export function analyzeQuickScan(args: { html: string; url: string; finalUrl?: string }): QuickScanResult {
  const truncated = args.html.length > MAX_QUICK_SCAN_HTML;
  const html = truncated ? args.html.slice(0, MAX_QUICK_SCAN_HTML) : args.html;
  const finalUrl = args.finalUrl ?? args.url;

  const htmlNoScripts = stripScriptsAndStyles(html);

  const bodyMatch = htmlNoScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = (bodyMatch?.[1] ?? htmlNoScripts)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const isLikelyJsRendered =
    bodyText.split(' ').filter(Boolean).length < 80 &&
    /id=["'](app|root|__next|nuxt|ember-application)["']/i.test(html);

  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const metaDesc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
    '';
  const h1s = [...htmlNoScripts.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    (m[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
  const canonicalHref =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ??
    '';
  const hasRobotsMeta = /noindex/i.test(
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? '',
  );

  const jsonLdBlocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  const schemaTypes = jsonLdBlocks.flatMap((block) =>
    [...(block[1] ?? '').matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1] ?? ''),
  );

  const wordCount = bodyText.split(' ').filter(Boolean).length;

  const issues: QuickScanIssue[] = [];

  if (isLikelyJsRendered) {
    issues.push({
      type: 'js_rendered',
      severity: 'warning',
      description:
        'Page appears to be client-side rendered — the initial HTML is nearly empty. AI crawlers and this scan see only the shell, not the actual content.',
      recommendation:
        'Enable server-side rendering (SSR) or static generation (SSG) so content is in the initial HTML response.',
    });
  }

  if (!title) {
    issues.push({ type: 'missing_title', severity: 'critical', description: 'Page has no <title> tag', recommendation: 'Add a descriptive title tag (50–60 characters)' });
  } else if (title.length > 60) {
    issues.push({ type: 'title_too_long', severity: 'warning', description: `Title is ${title.length} characters — may be truncated in search`, recommendation: 'Keep title under 60 characters' });
  } else if (title.length < 30) {
    issues.push({ type: 'title_too_short', severity: 'warning', description: `Title is only ${title.length} characters`, recommendation: 'Expand title to 30–60 characters with primary keyword' });
  }

  if (!metaDesc) {
    issues.push({ type: 'missing_meta_desc', severity: 'warning', description: 'No meta description found', recommendation: 'Add a meta description (150–160 characters)' });
  } else if (metaDesc.length > 160) {
    issues.push({ type: 'meta_desc_too_long', severity: 'info', description: `Meta description is ${metaDesc.length} characters`, recommendation: 'Keep meta description under 160 characters' });
  }

  if (h1s.length === 0) {
    issues.push({ type: 'missing_h1', severity: 'critical', description: 'No H1 heading found', recommendation: 'Add a single H1 that clearly identifies the page topic' });
  } else if (h1s.length > 1) {
    issues.push({ type: 'multiple_h1', severity: 'warning', description: `Page has ${h1s.length} H1 tags — AI systems expect a single primary heading`, recommendation: 'Consolidate to one H1' });
  }

  if (hasRobotsMeta) {
    issues.push({ type: 'noindex', severity: 'critical', description: 'Page has noindex directive — invisible to search engines and AI crawlers', recommendation: 'Remove noindex if this page should be indexed' });
  }

  if (canonicalHref) {
    const normalise = (u: string) => u.replace(/\/$/, '').toLowerCase();
    if (normalise(canonicalHref) !== normalise(args.url) && normalise(canonicalHref) !== normalise(finalUrl)) {
      issues.push({ type: 'canonical_mismatch', severity: 'info', description: `Canonical points to a different URL: ${canonicalHref}`, recommendation: 'Verify canonical URL is intentional — if this is a redirect target, update the canonical to match the final URL.' });
    }
  }

  if (wordCount < 300) {
    issues.push({ type: 'thin_content', severity: 'warning', description: `Page has approximately ${wordCount} words — may be too thin for AI retrieval`, recommendation: 'Add substantive content (aim for 500+ words for AI extractability)' });
  }

  if (schemaTypes.length === 0) {
    issues.push({ type: 'no_schema', severity: 'warning', description: 'No structured data (schema.org) found', recommendation: 'Add relevant schema markup to improve AI and search understanding' });
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const quickScore = Math.max(0, 100 - criticalCount * 15 - warningCount * 5);

  return {
    quickScore,
    title,
    metaDescription: metaDesc,
    h1s,
    schemaTypes: [...new Set(schemaTypes)],
    wordCount,
    canonical: canonicalHref || null,
    isNoindex: hasRobotsMeta,
    isLikelyJsRendered,
    truncated,
    issues,
    summary: {
      critical: criticalCount,
      warnings: warningCount,
      info: issues.filter((i) => i.severity === 'info').length,
    },
  };
}
