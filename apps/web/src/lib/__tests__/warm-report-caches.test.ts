import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  generateAndPersistIntelligenceReport: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/audit-intelligence/report-generation-service', () => ({ generateAndPersistIntelligenceReport: h.generateAndPersistIntelligenceReport }));
vi.mock('@/lib/logger', () => ({ logger: h.logger }));

const { warmReportCaches } = await import('../serverless-audit');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('warmReportCaches', () => {
  it('calls the single canonical generation/persistence entry point for the completed audit, never a separate generator', async () => {
    h.generateAndPersistIntelligenceReport.mockResolvedValue({ status: 'ready' });

    const status = await warmReportCaches('a1', 'truvyx.org');

    expect(h.generateAndPersistIntelligenceReport).toHaveBeenCalledWith('a1');
    expect(h.generateAndPersistIntelligenceReport).toHaveBeenCalledTimes(1);
    expect(status).toBe('ready');
  });

  it('never throws when generation fails — a report-generation failure must not surface anywhere near the audit result', async () => {
    h.generateAndPersistIntelligenceReport.mockRejectedValue(new Error('provider down'));

    await expect(warmReportCaches('a1', 'truvyx.org')).resolves.toBe('error');
  });

  it('propagates a "failed" status without throwing when generation completes but produces nothing', async () => {
    h.generateAndPersistIntelligenceReport.mockResolvedValue({ status: 'failed' });

    const status = await warmReportCaches('a1', 'truvyx.org');

    expect(status).toBe('failed');
    expect(h.logger.warn).toHaveBeenCalled();
  });

  it('propagates a "skipped" status when the idempotency claim was already held by another caller', async () => {
    h.generateAndPersistIntelligenceReport.mockResolvedValue({ status: 'skipped' });

    const status = await warmReportCaches('a1', 'truvyx.org');

    expect(status).toBe('skipped');
  });
});
