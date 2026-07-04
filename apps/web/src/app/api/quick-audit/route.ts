export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1|fc00:|fe80:)/i;

const QuickAuditSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'URL must use http or https',
    })
    .refine(
      (u) => {
        try {
          const { hostname } = new URL(u);
          return !PRIVATE_IP_RE.test(hostname);
        } catch {
          return false;
        }
      },
      { message: 'Private or reserved addresses are not allowed' },
    ),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = await rateLimit('quick-audit', ip, { limit: 20, windowSec: 3600 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can run 20 quick audits per hour.' },
      { status: 429, headers: rl.headers },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = QuickAuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url } = parsed.data;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let html = '';
    let status = 0;
    let finalUrl = url;
    let ttfb = 0;

    try {
      const t0 = Date.now();
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SiteNexis-QuickAudit/1.0 (+https://sitenexis.com)',
          Accept: 'text/html',
        },
        redirect: 'follow',
      });
      ttfb = Date.now() - t0;
      status = res.status;
      finalUrl = res.url;
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    if (status >= 400) {
      return NextResponse.json({
        url,
        status,
        error: `Page returned HTTP ${status}`,
        issues: [{ type: 'http_error', severity: 'critical', description: `Page returned HTTP ${status}` }],
      });
    }

    // Strip <script> and <style> content before any text analysis.
    // Without this, inline JS/CSS inflates word count and triggers false @type matches.
    const htmlNoScripts = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    // Detect JS-rendered pages: meaningful head signals but near-empty body text
    const bodyMatch = htmlNoScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyText = (bodyMatch?.[1] ?? htmlNoScripts).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isLikelyJsRendered =
      bodyText.split(' ').filter(Boolean).length < 80 &&
      /id=["'](app|root|__next|nuxt|ember-application)["']/i.test(html);

    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
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

    // Only extract @type from actual JSON-LD blocks, not from arbitrary JS objects.
    const jsonLdBlocks = [
      ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ];
    const schemaTypes = jsonLdBlocks.flatMap((block) =>
      [...(block[1] ?? '').matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1] ?? ''),
    );

    const wordCount = bodyText.split(' ').filter(Boolean).length;

    const issues: { type: string; severity: string; description: string; recommendation: string }[] = [];

    if (isLikelyJsRendered) {
      issues.push({
        type: 'js_rendered',
        severity: 'warning',
        description: 'Page appears to be client-side rendered — the initial HTML is nearly empty. AI crawlers and this scan see only the shell, not the actual content.',
        recommendation: 'Enable server-side rendering (SSR) or static generation (SSG) so content is in the initial HTML response.',
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
      if (normalise(canonicalHref) !== normalise(url) && normalise(canonicalHref) !== normalise(finalUrl)) {
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

    return NextResponse.json({
      url: finalUrl,
      status,
      ttfbMs: ttfb,
      quickScore,
      title,
      metaDescription: metaDesc,
      h1s,
      schemaTypes: [...new Set(schemaTypes)],
      wordCount,
      canonical: canonicalHref || null,
      isNoindex: hasRobotsMeta,
      issues,
      summary: {
        critical: criticalCount,
        warnings: warningCount,
        info: issues.filter((i) => i.severity === 'info').length,
      },
      note: 'Quick audit scans a single page without authentication. Run a full audit for deep AI visibility, entity intelligence, and machine trust analysis.',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Page took too long to respond (10s timeout)' }, { status: 408 });
    }
    logger.error({ err, url }, 'Quick audit fetch failed');
    return NextResponse.json({ error: 'Could not fetch page' }, { status: 502 });
  }
}
