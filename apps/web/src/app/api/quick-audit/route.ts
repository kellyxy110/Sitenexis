export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeQuickScan } from '@sitenexis/analyzers';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// Private / reserved / loopback addresses an SSRF probe must never be able to reach.
// Covers IPv4 (loopback, RFC1918, link-local, unspecified) and IPv6 (loopback ::1,
// unspecified ::, IPv4-mapped ::ffff:, ULA fc00::/7 → fc/fd, link-local fe80::/10).
const PRIVATE_IP_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1?$|::ffff:|f[cd][0-9a-f]{2}:|fe80:)/i;

/** True if the URL resolves to a private/reserved/loopback host (IPv4 or IPv6). */
export function isPrivateHostUrl(u: string): boolean {
  try {
    // Node keeps IPv6 hosts bracketed in `.hostname` (e.g. "[::1]") — strip the
    // brackets before matching so IPv6 loopback/link-local can't slip through.
    const host = new URL(u).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return PRIVATE_IP_RE.test(host);
  } catch {
    return true; // unparseable → treat as disallowed
  }
}

const QuickAuditSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'URL must use http or https',
    })
    .refine((u) => !isPrivateHostUrl(u), {
      message: 'Private or reserved addresses are not allowed',
    }),
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

    // Delegate all HTML analysis to the pure, size-bounded, linear-time quick-scan
    // analyzer. It hard-caps input size and strips scripts/styles without a
    // backtracking regex, so no page — however large or hostile — can make this
    // handler run unbounded. Regression-tested in @sitenexis/analyzers.
    const scan = analyzeQuickScan({ html, url, finalUrl });

    return NextResponse.json({
      url: finalUrl,
      status,
      ttfbMs: ttfb,
      quickScore: scan.quickScore,
      title: scan.title,
      metaDescription: scan.metaDescription,
      h1s: scan.h1s,
      schemaTypes: scan.schemaTypes,
      wordCount: scan.wordCount,
      canonical: scan.canonical,
      isNoindex: scan.isNoindex,
      truncated: scan.truncated,
      issues: scan.issues,
      summary: scan.summary,
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
