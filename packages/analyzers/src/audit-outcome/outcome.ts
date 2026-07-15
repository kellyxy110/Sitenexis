/**
 * Audit Outcome State Machine — a non-negotiable engineering invariant.
 *
 * No audit may ever terminate without a machine-readable outcome. Every audit ends
 * in EXACTLY ONE AuditOutcomeState, and every outcome carries: reason, stage,
 * diagnostics, recovery suggestions, and retry guidance. There is no blank report,
 * no forever-spinner, no silent exception, no generic "something went wrong".
 *
 * This module is pure and dependency-free so it is unit-testable and can be reused by
 * every code path that terminates an audit (quick-audit, full pipeline, agents).
 */

export const AUDIT_OUTCOME_STATES = [
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'PARTIAL',
  'UNREACHABLE',
  'BLOCKED',
  'TIMEOUT',
  'AUTH_REQUIRED',
  'RATE_LIMITED',
  'ROBOTS_RESTRICTED',
  'UNSUPPORTED',
  'FAILED',
] as const;

export type AuditOutcomeState = (typeof AUDIT_OUTCOME_STATES)[number];

/** The pipeline stage at which the audit reached its terminal state. */
export type AuditStage =
  | 'input_validation'
  | 'rate_limit'
  | 'dns'
  | 'fetch'
  | 'bot_mitigation'
  | 'robots'
  | 'render'
  | 'extraction'
  | 'analysis'
  | 'scoring'
  | 'report';

export interface AuditOutcome {
  state: AuditOutcomeState;
  /** Human-readable, specific cause — never generic. */
  reason: string;
  /** Where it terminated. */
  stage: AuditStage;
  /** Machine-readable diagnostics for support/telemetry. */
  diagnostics: Record<string, unknown>;
  /** What the user can do about it. */
  recovery: string;
  /** Whether/how to retry. */
  retry: { retryable: boolean; afterMs?: number; note: string };
  /** True when the audit produced usable analytical output (SUCCESS / SUCCESS_WITH_WARNINGS / PARTIAL). */
  hasResult: boolean;
}

const RESULT_BEARING: ReadonlySet<AuditOutcomeState> = new Set([
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'PARTIAL',
]);

/** Construct an outcome, enforcing that every required field is present and non-empty. */
export function makeOutcome(o: Omit<AuditOutcome, 'hasResult'>): AuditOutcome {
  if (!AUDIT_OUTCOME_STATES.includes(o.state)) {
    throw new Error(`Invalid audit outcome state: ${o.state}`);
  }
  for (const field of ['reason', 'recovery'] as const) {
    if (!o[field] || !o[field].trim()) throw new Error(`Audit outcome missing ${field}`);
  }
  if (!o.retry || typeof o.retry.retryable !== 'boolean' || !o.retry.note?.trim()) {
    throw new Error('Audit outcome missing retry guidance');
  }
  return { ...o, diagnostics: o.diagnostics ?? {}, hasResult: RESULT_BEARING.has(o.state) };
}

export function isTerminalOutcome(value: unknown): value is AuditOutcome {
  return (
    typeof value === 'object' &&
    value !== null &&
    AUDIT_OUTCOME_STATES.includes((value as AuditOutcome).state) &&
    typeof (value as AuditOutcome).reason === 'string' &&
    typeof (value as AuditOutcome).stage === 'string' &&
    typeof (value as AuditOutcome).recovery === 'string' &&
    typeof (value as AuditOutcome).retry === 'object'
  );
}

// ── Classifier for the single-page quick-scan path ─────────────────────────────

export interface QuickScanOutcomeInput {
  /** HTTP status of the fetch to the audited page (0 = never got a response). */
  httpStatus: number;
  /** Set when the fetch threw (DNS failure, connection refused, abort). */
  fetchError?: { name?: string; message?: string };
  /** Bot-mitigation verdict, if computed (see detectBotMitigation). */
  botMitigation?: { blocked: boolean; vendorLabel?: string } | null;
  /** True if robots.txt disallowed the scan. */
  robotsDisallowed?: boolean;
  /** Count of critical/warning issues, when analysis completed. */
  issueCounts?: { critical: number; warning: number };
  /** True if HTML was truncated by the size cap (analysis still valid, just partial). */
  truncated?: boolean;
}

/**
 * Deterministically map a quick-scan terminal condition to a canonical AuditOutcome.
 * Ordering matters: the most specific terminal cause wins.
 */
export function classifyQuickScanOutcome(input: QuickScanOutcomeInput): AuditOutcome {
  const { httpStatus, fetchError, botMitigation, robotsDisallowed, issueCounts, truncated } = input;

  if (robotsDisallowed) {
    return makeOutcome({
      state: 'ROBOTS_RESTRICTED',
      stage: 'robots',
      reason: 'robots.txt disallows automated access to this URL.',
      diagnostics: { httpStatus },
      recovery: 'Audit a URL your robots.txt permits, or verify the site owner allows automated auditing.',
      retry: { retryable: false, note: 'Retrying will not help until robots.txt changes.' },
    });
  }

  if (fetchError) {
    const isAbort = fetchError.name === 'AbortError';
    if (isAbort) {
      return makeOutcome({
        state: 'TIMEOUT',
        stage: 'fetch',
        reason: 'The page did not respond within the 10s fetch budget.',
        diagnostics: { fetchError: fetchError.message },
        recovery: 'Improve server response time (TTFB), or try again when the site is faster.',
        retry: { retryable: true, afterMs: 5_000, note: 'A transient slow response may clear on retry.' },
      });
    }
    return makeOutcome({
      state: 'UNREACHABLE',
      stage: 'dns',
      reason: 'The page could not be reached — the domain may not resolve or the server refused the connection.',
      diagnostics: { fetchError: fetchError.message },
      recovery: 'Verify the domain resolves and the server is reachable over HTTPS.',
      retry: { retryable: true, afterMs: 30_000, note: 'Retry after confirming DNS/connectivity.' },
    });
  }

  if (botMitigation?.blocked) {
    return makeOutcome({
      state: 'BLOCKED',
      stage: 'bot_mitigation',
      reason: `Blocked by bot-mitigation${botMitigation.vendorLabel ? ` (${botMitigation.vendorLabel})` : ''}.`,
      diagnostics: { httpStatus, vendor: botMitigation.vendorLabel },
      recovery: 'This site blocks non-browser clients. A full audit with a headless browser (CRAWL4AI_URL) can pass; quick-audit cannot.',
      retry: { retryable: false, note: 'Retrying the same fetch path will be blocked identically.' },
    });
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return makeOutcome({
      state: 'AUTH_REQUIRED',
      stage: 'fetch',
      reason: `The page requires authentication or authorization (HTTP ${httpStatus}).`,
      diagnostics: { httpStatus },
      recovery: 'Audit a publicly accessible URL, or use an authenticated full audit.',
      retry: { retryable: false, note: 'Anonymous retry will return the same status.' },
    });
  }

  if (httpStatus === 429) {
    return makeOutcome({
      state: 'RATE_LIMITED',
      stage: 'rate_limit',
      reason: 'The audit rate limit was exceeded.',
      diagnostics: { httpStatus },
      recovery: 'Wait for the rate-limit window to reset, then retry.',
      retry: { retryable: true, afterMs: 60_000, note: 'Retry after the window resets (see Retry-After).' },
    });
  }

  if (httpStatus >= 400) {
    return makeOutcome({
      state: 'FAILED',
      stage: 'fetch',
      reason: `The page returned HTTP ${httpStatus}.`,
      diagnostics: { httpStatus },
      recovery: 'Confirm the URL is correct and the page is published.',
      retry: { retryable: httpStatus >= 500, afterMs: 15_000, note: httpStatus >= 500 ? 'Server errors may be transient.' : 'A 4xx will not change on retry.' },
    });
  }

  // 2xx/3xx-followed: analysis completed.
  const critical = issueCounts?.critical ?? 0;
  const warning = issueCounts?.warning ?? 0;
  if (truncated) {
    return makeOutcome({
      state: 'PARTIAL',
      stage: 'analysis',
      reason: 'The page was analysed, but its HTML exceeded the size cap and was truncated.',
      diagnostics: { critical, warning, truncated: true },
      recovery: 'Results reflect the first portion of a very large page; run a full audit for complete coverage.',
      retry: { retryable: false, note: 'The full audit pipeline handles large pages via streaming extraction.' },
    });
  }
  if (critical > 0 || warning > 0) {
    return makeOutcome({
      state: 'SUCCESS_WITH_WARNINGS',
      stage: 'scoring',
      reason: `Audited successfully with ${critical} critical and ${warning} warning issue(s).`,
      diagnostics: { critical, warning },
      recovery: 'Address the reported issues to improve the score.',
      retry: { retryable: false, note: 'No retry needed — this is a complete result.' },
    });
  }
  return makeOutcome({
    state: 'SUCCESS',
    stage: 'scoring',
    reason: 'Audited successfully with no issues detected.',
    diagnostics: { critical: 0, warning: 0 },
    recovery: 'No action required.',
    retry: { retryable: false, note: 'No retry needed — this is a complete result.' },
  });
}
