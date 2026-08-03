import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getExecutiveSummary: vi.fn(),
  getNarrativeReport: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/audit-intelligence/executive-summary-service', () => ({ getExecutiveSummary: h.getExecutiveSummary }));
vi.mock('@/lib/audit-intelligence/narrative-report-service', () => ({ getNarrativeReport: h.getNarrativeReport }));
vi.mock('@/lib/logger', () => ({ logger: h.logger }));

const { warmReportCaches } = await import('../serverless-audit');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('warmReportCaches', () => {
  it('calls both canonical report generators for the completed audit, never a separate one', async () => {
    h.getExecutiveSummary.mockResolvedValue({ state: 'complete', data: { auditId: 'a1' } });
    h.getNarrativeReport.mockResolvedValue({ state: 'complete', data: { auditId: 'a1' } });

    await warmReportCaches('a1', 'truvyx.org');

    expect(h.getExecutiveSummary).toHaveBeenCalledWith('a1');
    expect(h.getNarrativeReport).toHaveBeenCalledWith('a1');
  });

  it('never throws when both generators fail — a warm-cache failure must not surface anywhere near the audit result', async () => {
    h.getExecutiveSummary.mockRejectedValue(new Error('redis down'));
    h.getNarrativeReport.mockRejectedValue(new Error('redis down'));

    await expect(warmReportCaches('a1', 'truvyx.org')).resolves.toBeUndefined();
    expect(h.logger.warn).not.toHaveBeenCalled();
  });

  it('runs both generators even when one fails (Promise.allSettled, not Promise.all)', async () => {
    h.getExecutiveSummary.mockRejectedValue(new Error('one failed'));
    h.getNarrativeReport.mockResolvedValue({ state: 'complete', data: { auditId: 'a1' } });

    await warmReportCaches('a1', 'truvyx.org');

    expect(h.getNarrativeReport).toHaveBeenCalled();
  });
});
