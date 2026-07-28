import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// The route does a real (unmocked) dynamic import of @sitenexis/analyzers for
// dedupeFindings — under full-suite parallel load that import alone can exceed
// the default 5s test timeout, independent of any logic under test.
vi.setConfig({ testTimeout: 20_000 });

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditWithResults: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getPagesByAudit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getIssuesByAudit: h.getIssuesByAudit,
  getPagesByAudit: h.getPagesByAudit,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

function issue(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'issue-1', auditId: 'audit-1', pageId: null, pageUrl: null,
    module: 'seo', type: 'title_too_long', severity: 'warning',
    message: 'Title is too long', recommendation: 'Shorten the title to under 70 characters.',
    problem: null, solution: null, fixCode: null, fixLanguage: null,
    renderMethod: 'static-html', confidence: 'high',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditWithResults.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'complete' });
  h.getPagesByAudit.mockResolvedValue([]);
});

describe('GET /api/audit/[id]/action-plan', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditWithResults.mockResolvedValueOnce({ id: 'audit-1', userId: 'someone-else', domain: 'example.com', status: 'complete' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
  });

  it('empty state when the audit does not exist', async () => {
    h.getAuditWithResults.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.state).toBe('empty');
  });

  it('groups the same title-length finding across three pages into one card with all URLs preserved', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', pageUrl: 'https://x.com/a', message: 'Title is 101 chars (max 70)' }),
      issue({ id: 'i2', pageUrl: 'https://x.com/b', message: 'Title is 89 chars (max 70)' }),
      issue({ id: 'i3', pageUrl: 'https://x.com/c', message: 'Title is 79 chars (max 70)' }),
    ]);

    const res = await GET(req(), params);
    const json = await res.json();

    expect(json.data.cards).toHaveLength(1);
    const card = json.data.cards[0];
    expect(card.affectedPageCount).toBe(3);
    expect(card.affectedUrls.sort()).toEqual(['https://x.com/a', 'https://x.com/b', 'https://x.com/c']);
    expect(card.pages).toHaveLength(3);
    expect(json.data.totalRawIssues).toBe(3);
  });

  it('does not merge two genuinely different issue types', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', type: 'missing_h1', message: 'No <h1> tag found', pageUrl: 'https://x.com/a' }),
      issue({ id: 'i2', type: 'missing_title', message: 'No <title> tag found', recommendation: 'Add a descriptive title tag.', pageUrl: 'https://x.com/b' }),
    ]);

    const res = await GET(req(), params);
    const json = await res.json();

    expect(json.data.cards).toHaveLength(2);
  });

  it('attaches page title/h1/wordCount evidence from the Page table when pageId is set', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', pageId: 'page-1', pageUrl: 'https://x.com/a', type: 'missing_h1', message: 'No <h1> tag found' }),
    ]);
    h.getPagesByAudit.mockResolvedValueOnce([
      { id: 'page-1', url: 'https://x.com/a', title: 'Existing Title', h1: null, wordCount: 42 },
    ]);

    const res = await GET(req(), params);
    const json = await res.json();

    expect(json.data.cards[0].pages[0].title).toBe('Existing Title');
    expect(json.data.cards[0].pages[0].wordCount).toBe(42);
  });

  it('surfaces low-confidence findings distinctly from high-confidence ones', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', type: 'missing_h1', confidence: 'low', pageUrl: 'https://x.com/a', message: 'No H1 was detected in the static HTML response.' }),
    ]);

    const res = await GET(req(), params);
    const json = await res.json();

    expect(json.data.cards[0].confidence).toBe('low');
  });
});
