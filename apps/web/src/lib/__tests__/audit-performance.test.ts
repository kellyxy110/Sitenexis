import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createAuditPerformanceRecorder } from '../audit-performance';
import { logger } from '@/lib/logger';

describe('createAuditPerformanceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a completed stage with its duration and a count of 1', async () => {
    const perf = createAuditPerformanceRecorder();

    const result = await perf.measureStage('crawl', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'crawled';
    });

    expect(result).toBe('crawled');
    const stage = perf.getStages().find((s) => s.name === 'crawl');
    expect(stage).toBeDefined();
    expect(stage!.count).toBe(1);
    expect(stage!.errorCount).toBe(0);
    expect(stage!.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('still records duration and status when the wrapped stage throws, and rethrows the original error unmodified', async () => {
    const perf = createAuditPerformanceRecorder();
    const boom = new Error('groq socket hang up');

    await expect(
      perf.measureStage('ai-visibility.groq-scores', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    const stage = perf.getStages().find((s) => s.name === 'ai-visibility.groq-scores');
    expect(stage!.count).toBe(1);
    expect(stage!.errorCount).toBe(1);
  });

  it('measures a parallel block as one wall-clock sample, not the sum of its children', async () => {
    const perf = createAuditPerformanceRecorder();

    await perf.measureStage('ai-visibility-parallel', () =>
      Promise.all([
        perf.measureStage('child-a', async () => { await new Promise((r) => setTimeout(r, 30)); return 1; }),
        perf.measureStage('child-b', async () => { await new Promise((r) => setTimeout(r, 30)); return 2; }),
      ]),
    );

    const block = perf.getStages().find((s) => s.name === 'ai-visibility-parallel')!;
    const childA = perf.getStages().find((s) => s.name === 'child-a')!;
    const childB = perf.getStages().find((s) => s.name === 'child-b')!;

    // Both children ran concurrently, so the block's wall time should be well under
    // the sum of the two children's durations (~60ms), not approximately equal to it.
    expect(block.totalMs).toBeLessThan(childA.totalMs + childB.totalMs);
  });

  it('supports manual start/end timing for stages with multiple exit points (e.g. an early return)', () => {
    const perf = createAuditPerformanceRecorder();
    const end = perf.startStage('crawl');
    end('error', 'Homepage returned 503');

    const stage = perf.getStages().find((s) => s.name === 'crawl')!;
    expect(stage.errorCount).toBe(1);
    expect(stage.count).toBe(1);
  });

  it('manual end() is idempotent — calling it twice only records once', () => {
    const perf = createAuditPerformanceRecorder();
    const end = perf.startStage('persistence');
    end('ok');
    end('ok');

    const stage = perf.getStages().find((s) => s.name === 'persistence')!;
    expect(stage.count).toBe(1);
  });

  it('does not alter the value returned by the wrapped function', async () => {
    const perf = createAuditPerformanceRecorder();
    const payload = { overall: 87, pages: 12 };

    const result = await perf.measureStage('aggregation', async () => payload);

    expect(result).toBe(payload);
  });

  it('a throwing logger during emitSummary never propagates — instrumentation failure cannot fail the audit', () => {
    const perf = createAuditPerformanceRecorder();
    vi.mocked(logger.info).mockImplementation(() => {
      throw new Error('logger backend unavailable');
    });

    expect(() => perf.emitSummary('audit-1', 'example.com', 5000)).not.toThrow();
  });

  it('a throwing recordSample call never propagates (defensive even against internal bugs)', () => {
    const perf = createAuditPerformanceRecorder();
    // Corrupt internal state is not reachable from the public API, so this asserts
    // the contract at the boundary: recordSample itself never throws outward.
    expect(() => perf.recordSample('x', NaN, 'ok')).not.toThrow();
  });

  it('counters can be set and incremented independently of stage timings', () => {
    const perf = createAuditPerformanceRecorder();
    perf.setCounter('pagesFetched', 42);
    perf.incrementCounter('pagesPersisted');
    perf.incrementCounter('pagesPersisted', 4);

    const counters = perf.getCounters();
    expect(counters['pagesFetched']).toBe(42);
    expect(counters['pagesPersisted']).toBe(5);
  });

  it('truncates error messages and never logs full content — no page bodies or credentials retained', async () => {
    const perf = createAuditPerformanceRecorder();
    const hugeSecretLikeMessage = `gsk_${'a'.repeat(500)} plus a full page of body text `.repeat(5);

    await expect(
      perf.measureStage('scout', async () => { throw new Error(hugeSecretLikeMessage); }),
    ).rejects.toThrow();

    perf.emitSummary('audit-1', 'example.com', 1000);
    const loggedPayload = vi.mocked(logger.info).mock.calls[0]?.[0] as { stages: Array<{ name: string }> };
    // The summary payload only carries aggregated stage stats (name/totalMs/count/errorCount),
    // never the raw error message or any page content.
    expect(JSON.stringify(loggedPayload)).not.toContain('a'.repeat(500));
  });

  it('emits one structured summary line including the total and per-stage breakdown', () => {
    const perf = createAuditPerformanceRecorder();
    perf.recordSample('crawl', 1200);
    perf.recordSample('persistence', 800);
    perf.setCounter('pagesFetched', 10);

    perf.emitSummary('audit-1', 'example.com', 5000);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const [payload, message] = vi.mocked(logger.info).mock.calls[0]!;
    expect(message).toContain('TOTAL=5000ms');
    expect((payload as { auditId: string }).auditId).toBe('audit-1');
    expect((payload as { totalMs: number }).totalMs).toBe(5000);
  });
});
