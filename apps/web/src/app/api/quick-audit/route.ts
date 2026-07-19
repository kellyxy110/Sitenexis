export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeQuickScan, classifyQuickScanOutcome, detectBotMitigation } from '@sitenexis/analyzers';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

// Private / reserved / loopback addresses an SSRF probe must never be able to reach.
// Covers IPv4 (loopback, RFC1918, link-local, unspecified) and IPv6 (loopback ::1,
// unspecified ::, IPv4-mapped ::ffff:, ULA fc00::/7 → fc/fd, link-local fe80::/10).
const PRIVATE_IP_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1?$|::ffff:|f[cd][0-9a-f]{2}:|fe80:)/i;

/** True if the URL resolves to a private/reserved/loopback host (IPv4 or IPv6). */
function isPrivateHostUrl(u: string): boolean {
  try {
    // Node keeps IPv6 hosts bracketed in `.hostname` (e.g. "[::1]") — strip the
    // brackets before matching so IPv6 loopback/link-local can't slip through.
    const host = new URL(u).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return PRIVATE_IP_RE.test(host);
  } catch {
    return true; // unparseable → treat as disallowed
  }
}

/**
 * Fetch that follows redirects manually, re-validating the host at EVERY hop.
 * `redirect: 'follow'` is an SSRF hole: a public URL can 302 to http://169.254.169.254/
 * (cloud metadata) or another internal host, and the browser fetch would dutifully
 * request it. Here each Location is resolved and checked against the private-host
 * filter before it is followed; a redirect toward a private/reserved host aborts.
 */
async function fetchNoInternalRedirects(
  startUrl: string,
  init: RequestInit,
  maxHops = 5,
): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current, { ...init, redirect: 'manual' });
    // undici surfaces a manual redirect as an opaqueredirect/3xx with a Location.
    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location');
    if (!isRedirect) return res;
    const next = new URL(res.headers.get('location') as string, current).href;
    if (isPrivateHostUrl(next)) {
      const e = new Error('Redirect to a private or reserved address was blocked') as Error & { code?: string };
      e.name = 'SSRFRedirectError';
      e.code = 'SSRF_REDIRECT';
      throw e;
    }
    current = next;
  }
  const e = new Error('Too many redirects') as Error & { code?: string };
  e.name = 'TooManyRedirects';
  throw e;
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
  const limit = env.QUICK_AUDIT_RATE_LIMIT;
  const rl = await rateLimit('quick-audit', ip, { limit, windowSec: 3600 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. You can run ${limit} quick audits per hour.` },
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

  // Normalise the validated URL through the URL constructor before it is ever fetched
  // or echoed. This percent-encodes anything hostile in the path (e.g. an injected
  // `<script>` becomes `%3Cscript%3E`), so the endpoint never reflects raw
  // attacker-controlled markup back in its JSON response.
  const url = new URL(parsed.data.url).href;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let html = '';
    let status = 0;
    let finalUrl = url;
    let ttfb = 0;
    let responseHeaders: Record<string, string> = {};

    try {
      const t0 = Date.now();
      const res = await fetchNoInternalRedirects(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': `SiteNexis-QuickAudit/1.0 (+${process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app'})`,
          Accept: 'text/html',
        },
      });
      ttfb = Date.now() - t0;
      status = res.status;
      finalUrl = res.url;
      responseHeaders = Object.fromEntries(res.headers.entries());
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    if (status >= 400) {
      // Distinguish a bot-mitigation block from a plain HTTP error so the outcome
      // is BLOCKED (with the vendor) rather than a generic FAILED.
      const mitigation = detectBotMitigation(status, responseHeaders, html);
      const outcome = classifyQuickScanOutcome({
        httpStatus: status,
        botMitigation: mitigation.blocked ? { blocked: true, vendorLabel: mitigation.vendorLabel } : null,
      });
      return NextResponse.json({
        url,
        status,
        outcome,
        error: outcome.reason,
        issues: [{ type: 'http_error', severity: 'critical', description: outcome.reason }],
      });
    }

    // Delegate all HTML analysis to the pure, size-bounded, linear-time quick-scan
    // analyzer. It hard-caps input size and strips scripts/styles without a
    // backtracking regex, so no page — however large or hostile — can make this
    // handler run unbounded. Regression-tested in @sitenexis/analyzers.
    const scan = analyzeQuickScan({ html, url, finalUrl });
    const outcome = classifyQuickScanOutcome({
      httpStatus: status,
      truncated: scan.truncated,
      issueCounts: { critical: scan.summary.critical, warning: scan.summary.warnings },
    });

    return NextResponse.json({
      url: finalUrl,
      status,
      outcome,
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
    // A failure to reach the AUDITED site (timeout, DNS failure, connection refused)
    // is a property of that site, not a fault of this server. Return a graceful,
    // fully-explained 200 result — an unreachable site is a valid audit outcome, and
    // a 5xx here would both look like our outage and read as a "silent failure".
    // A redirect toward an internal host is an attempted SSRF — reject it clearly.
    if (err instanceof Error && (err as Error & { code?: string }).code === 'SSRF_REDIRECT') {
      logger.warn({ url }, 'Quick audit blocked an SSRF redirect');
      return NextResponse.json(
        { error: 'This URL redirects to a private or reserved address, which is not allowed.' },
        { status: 400 },
      );
    }
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const outcome = classifyQuickScanOutcome({
      httpStatus: 0,
      fetchError: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err) },
    });
    logger.warn({ err, url }, 'Quick audit could not reach target');
    return NextResponse.json({
      url,
      status: 0,
      outcome,
      error: outcome.reason,
      issues: [
        {
          type: isTimeout ? 'fetch_timeout' : 'unreachable',
          severity: 'critical',
          description: outcome.reason,
          recommendation: outcome.recovery,
        },
      ],
    });
  }
}
