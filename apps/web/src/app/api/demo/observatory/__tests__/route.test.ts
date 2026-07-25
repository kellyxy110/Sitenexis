import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  isFullyConfigured: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/lib/mode', () => ({ isFullyConfigured: h.isFullyConfigured }));
vi.mock('@sitenexis/db', () => ({
  db: { audit: { findMany: h.findMany, count: h.count } },
}));

const { GET } = await import('../route');

const completeAudit = {
  domain: 'genshipyard.com',
  completedAt: new Date('2026-06-22T00:00:00.000Z'),
  createdAt: new Date('2026-06-20T00:00:00.000Z'),
  pageCount: 8,
  scores: { overall: 79, schemaScore: 58 },
  aiVisibilityScores: {
    aiVisibilityScore: 72, semanticTrustScore: 72, retrievalReadinessScore: 75, citationProbabilityScore: 68,
  },
  issues: [
    { severity: 'warning', module: 'schema', message: 'missing schema', recommendation: 'add it' },
    { severity: 'critical', module: 'seo', message: 'no title', recommendation: 'add a title' },
    { severity: 'info', module: 'ai', message: 'entity consistent', recommendation: 'no action' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isFullyConfigured.mockReturnValue(true);
  h.findMany.mockResolvedValue([completeAudit]);
  h.count.mockResolvedValue(1234);
});

describe('GET /api/demo/observatory', () => {
  it('returns empty cards and null stats when the app is not fully configured', async () => {
    h.isFullyConfigured.mockReturnValue(false);
    const res = await GET();
    const json = await res.json();
    expect(json.cards).toEqual([]);
    expect(json.stats).toBeNull();
  });

  it('never fabricates data — returns the real audit count from the database', async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.stats.totalAuditsCompleted).toBe(1234);
    expect(h.count).toHaveBeenCalledWith({ where: { status: 'complete', archivedAt: null } });
  });

  it('derives critical/warning/passed counts and badges from real issue severities', async () => {
    const res = await GET();
    const json = await res.json();
    const [card] = json.cards;
    expect(card.critical).toBe(1);
    expect(card.warnings).toBe(1);
    expect(card.passed).toBe(1);
    expect(card.badges).toContain('AI Ready');
    expect(card.badges).not.toContain('No Critical Issues');
  });

  it('sorts topIssues with critical severity first', async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.cards[0].topIssues[0].severity).toBe('critical');
  });

  it('falls back to the raw domain as the label for an audit with no known metadata', async () => {
    h.findMany.mockResolvedValueOnce([{ ...completeAudit, domain: 'unknown-domain.com' }]);
    const res = await GET();
    const json = await res.json();
    expect(json.cards[0].label).toBe('unknown-domain.com');
    expect(json.cards[0].category).toBe('Other');
  });
});
