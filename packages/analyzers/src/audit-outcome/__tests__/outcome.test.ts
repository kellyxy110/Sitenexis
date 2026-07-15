import { describe, it, expect } from 'vitest';
import {
  AUDIT_OUTCOME_STATES,
  classifyQuickScanOutcome,
  makeOutcome,
  isTerminalOutcome,
  type AuditOutcome,
} from '../outcome';

/** Every terminal outcome must carry the full contract — this is the invariant. */
function assertComplete(o: AuditOutcome): void {
  expect(AUDIT_OUTCOME_STATES).toContain(o.state);
  expect(o.reason.trim().length).toBeGreaterThan(0);
  expect(o.stage.length).toBeGreaterThan(0);
  expect(typeof o.recovery).toBe('string');
  expect(o.recovery.trim().length).toBeGreaterThan(0);
  expect(typeof o.retry.retryable).toBe('boolean');
  expect(o.retry.note.trim().length).toBeGreaterThan(0);
  expect(o.reason).not.toMatch(/something went wrong/i);
  expect(isTerminalOutcome(o)).toBe(true);
}

describe('makeOutcome — contract enforcement', () => {
  it('rejects an empty reason', () => {
    expect(() =>
      makeOutcome({ state: 'FAILED', stage: 'fetch', reason: '', diagnostics: {}, recovery: 'x', retry: { retryable: false, note: 'n' } }),
    ).toThrow(/reason/);
  });
  it('rejects missing retry guidance', () => {
    // @ts-expect-error intentionally malformed
    expect(() => makeOutcome({ state: 'FAILED', stage: 'fetch', reason: 'r', recovery: 'x' })).toThrow(/retry/);
  });
  it('marks only SUCCESS/SUCCESS_WITH_WARNINGS/PARTIAL as result-bearing', () => {
    const ok = makeOutcome({ state: 'SUCCESS', stage: 'scoring', reason: 'r', diagnostics: {}, recovery: 'x', retry: { retryable: false, note: 'n' } });
    const bad = makeOutcome({ state: 'UNREACHABLE', stage: 'dns', reason: 'r', diagnostics: {}, recovery: 'x', retry: { retryable: true, note: 'n' } });
    expect(ok.hasResult).toBe(true);
    expect(bad.hasResult).toBe(false);
  });
});

describe('classifyQuickScanOutcome — every terminal condition maps to a complete outcome', () => {
  const cases: Array<[string, Parameters<typeof classifyQuickScanOutcome>[0], string]> = [
    ['success', { httpStatus: 200, issueCounts: { critical: 0, warning: 0 } }, 'SUCCESS'],
    ['success with warnings', { httpStatus: 200, issueCounts: { critical: 1, warning: 2 } }, 'SUCCESS_WITH_WARNINGS'],
    ['partial (truncated)', { httpStatus: 200, truncated: true, issueCounts: { critical: 0, warning: 0 } }, 'PARTIAL'],
    ['unreachable (DNS)', { httpStatus: 0, fetchError: { name: 'TypeError', message: 'getaddrinfo ENOTFOUND' } }, 'UNREACHABLE'],
    ['timeout', { httpStatus: 0, fetchError: { name: 'AbortError', message: 'aborted' } }, 'TIMEOUT'],
    ['blocked (bot mitigation)', { httpStatus: 403, botMitigation: { blocked: true, vendorLabel: 'Akamai' } }, 'BLOCKED'],
    ['auth required', { httpStatus: 401 }, 'AUTH_REQUIRED'],
    ['forbidden → auth required', { httpStatus: 403 }, 'AUTH_REQUIRED'],
    ['rate limited', { httpStatus: 429 }, 'RATE_LIMITED'],
    ['robots restricted', { httpStatus: 200, robotsDisallowed: true }, 'ROBOTS_RESTRICTED'],
    ['generic 404 → failed', { httpStatus: 404 }, 'FAILED'],
    ['5xx → failed (retryable)', { httpStatus: 503 }, 'FAILED'],
  ];

  for (const [name, input, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      const o = classifyQuickScanOutcome(input);
      expect(o.state).toBe(expected);
      assertComplete(o);
    });
  }

  it('bot-mitigation takes precedence over a bare 403 (BLOCKED, not AUTH_REQUIRED)', () => {
    expect(classifyQuickScanOutcome({ httpStatus: 403, botMitigation: { blocked: true, vendorLabel: 'Cloudflare' } }).state).toBe('BLOCKED');
  });

  it('a 5xx is retryable, a 4xx is not', () => {
    expect(classifyQuickScanOutcome({ httpStatus: 503 }).retry.retryable).toBe(true);
    expect(classifyQuickScanOutcome({ httpStatus: 404 }).retry.retryable).toBe(false);
  });

  it('covers a representative outcome for the non-quick-scan-only states too', () => {
    // UNSUPPORTED / SUCCESS states exist for the full pipeline; ensure the enum is complete.
    expect(AUDIT_OUTCOME_STATES).toEqual([
      'SUCCESS', 'SUCCESS_WITH_WARNINGS', 'PARTIAL', 'UNREACHABLE', 'BLOCKED',
      'TIMEOUT', 'AUTH_REQUIRED', 'RATE_LIMITED', 'ROBOTS_RESTRICTED', 'UNSUPPORTED', 'FAILED',
    ]);
  });
});
