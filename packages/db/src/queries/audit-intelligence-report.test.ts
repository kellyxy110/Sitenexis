import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('../client', () => ({
  db: {
    auditIntelligenceReport: {
      findUnique: h.findUnique,
      upsert: h.upsert,
      updateMany: h.updateMany,
    },
  },
}));

import {
  getAuditIntelligenceReport, claimReportGeneration, saveGeneratedReport,
  markReportGenerationFailed, resetReportForRegeneration,
} from './audit-intelligence-report';

beforeEach(() => {
  vi.clearAllMocks();
  h.upsert.mockResolvedValue({});
  h.updateMany.mockResolvedValue({ count: 1 });
  h.findUnique.mockResolvedValue(null);
});

describe('getAuditIntelligenceReport', () => {
  it('returns the row for the given audit', async () => {
    h.findUnique.mockResolvedValue({ auditId: 'a1', status: 'ready' });
    const result = await getAuditIntelligenceReport('a1');
    expect(result).toEqual({ auditId: 'a1', status: 'ready' });
    expect(h.findUnique).toHaveBeenCalledWith({ where: { auditId: 'a1' } });
  });

  it('returns null when no row exists', async () => {
    const result = await getAuditIntelligenceReport('a1');
    expect(result).toBeNull();
  });
});

describe('claimReportGeneration — idempotency', () => {
  it('ensures a row exists (upsert) before attempting to claim', async () => {
    await claimReportGeneration('a1');
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { auditId: 'a1' } }));
  });

  it('wins the claim when the conditional update affects a row (status was pending/failed)', async () => {
    h.updateMany.mockResolvedValue({ count: 1 });
    const claimed = await claimReportGeneration('a1');
    expect(claimed).toBe(true);
    expect(h.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ auditId: 'a1' }),
      data: expect.objectContaining({ status: 'generating' }),
    }));
  });

  it('loses the claim when nothing was eligible to update — another caller already owns it or it is already ready', async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    const claimed = await claimReportGeneration('a1');
    expect(claimed).toBe(false);
  });

  it('the conditional WHERE allows a stale "generating" claim to be re-claimed, but not a fresh one', async () => {
    await claimReportGeneration('a1');
    const call = h.updateMany.mock.calls[0]![0] as { where: { OR: Array<Record<string, unknown>> } };
    const staleClause = call.where.OR.find((c) => 'status' in c && c.status === 'generating');
    expect(staleClause).toBeDefined();
    expect(staleClause).toHaveProperty('updatedAt');
  });
});

describe('saveGeneratedReport', () => {
  it('derives status "ready" when both artifacts are present', async () => {
    await saveGeneratedReport('a1', { executiveSummary: { a: 1 }, narrativeReport: { b: 2 } });
    const call = h.upsert.mock.calls[0]![0] as { create: { status: string }; update: { status: string } };
    expect(call.create.status).toBe('ready');
    expect(call.update.status).toBe('ready');
  });

  it('derives status "partial" when only one artifact is present', async () => {
    await saveGeneratedReport('a1', { executiveSummary: { a: 1 } });
    const call = h.upsert.mock.calls[0]![0] as { create: { status: string } };
    expect(call.create.status).toBe('partial');
  });

  it('derives status "failed" when neither artifact is present', async () => {
    await saveGeneratedReport('a1', {});
    const call = h.upsert.mock.calls[0]![0] as { create: { status: string } };
    expect(call.create.status).toBe('failed');
  });

  it('never overwrites an existing artifact with nothing on a partial update', async () => {
    await saveGeneratedReport('a1', { narrativeReport: { b: 2 } });
    const call = h.upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect(call.update).not.toHaveProperty('executiveSummary');
    expect(call.update.narrativeReport).toEqual({ b: 2 });
  });

  it('clears lastError on a successful save', async () => {
    await saveGeneratedReport('a1', { executiveSummary: { a: 1 } });
    const call = h.upsert.mock.calls[0]![0] as { update: { lastError: unknown } };
    expect(call.update.lastError).toBeNull();
  });
});

describe('markReportGenerationFailed', () => {
  it('sets status failed and stores a truncated, sanitized error message', async () => {
    await markReportGenerationFailed('a1', 'x'.repeat(1000));
    const call = h.upsert.mock.calls[0]![0] as { update: { status: string; lastError: string } };
    expect(call.update.status).toBe('failed');
    expect(call.update.lastError.length).toBeLessThanOrEqual(500);
  });
});

describe('resetReportForRegeneration', () => {
  it('unconditionally sets status back to pending, regardless of current status', async () => {
    await resetReportForRegeneration('a1');
    const call = h.upsert.mock.calls[0]![0] as { update: { status: string } };
    expect(call.update.status).toBe('pending');
  });
});
