import type { Page } from '@playwright/test';

export const MOCK_AUDIT_ID     = 'audit-e2e-test-id';
export const MOCK_AUDIT_DOMAIN = 'example.com';

// SSE event sequence drives AuditProgress through all stages
const SSE_SEQUENCE = [
  { status: 'running', stage: 'crawl',  pagesCount: 0,  issuesCount: 0,  message: 'Crawling pages...' },
  { status: 'running', stage: 'crawl',  pagesCount: 12, issuesCount: 0,  message: 'Crawled 12 pages so far...' },
  { status: 'running', stage: 'seo',    pagesCount: 24, issuesCount: 3,  message: 'Analysing SEO signals...' },
  { status: 'running', stage: 'ai',     pagesCount: 24, issuesCount: 7,  message: 'Scoring AI readability...' },
  { status: 'running', stage: 'schema', pagesCount: 24, issuesCount: 9,  message: 'Validating structured data...' },
  { status: 'running', stage: 'links',  pagesCount: 24, issuesCount: 11, message: 'Building internal link graph...' },
  { status: 'running', stage: 'report', pagesCount: 24, issuesCount: 11, message: 'Finalising results...' },
  { status: 'complete', stage: 'report', pagesCount: 24, issuesCount: 11, message: 'Audit complete.' },
];

const MOCK_ISSUES = [
  { id: 'i1', type: 'missing_meta_description', severity: 'warning',  url: 'https://example.com/',      message: 'Missing meta description', recommendation: 'Add a 150-160 character meta description.', module: 'seo' },
  { id: 'i2', type: 'duplicate_title',          severity: 'critical', url: 'https://example.com/about', message: 'Duplicate title tag',      recommendation: 'Use unique title tags per page.',          module: 'seo' },
  { id: 'i3', type: 'missing_alt_text',         severity: 'info',     url: 'https://example.com/blog',  message: 'Image missing alt text',  recommendation: 'Add descriptive alt attributes.',           module: 'seo' },
];

// Full AuditData shape expected by /audit/[domain]/page.tsx
const MOCK_AUDIT_RESULT = {
  id:          MOCK_AUDIT_ID,
  domain:      MOCK_AUDIT_DOMAIN,
  status:      'complete',
  createdAt:   new Date().toISOString(),
  updatedAt:   new Date().toISOString(),
  completedAt: new Date().toISOString(),
  pageCount:   24,
  issues:      MOCK_ISSUES,
  pages: [
    {
      url:            'https://example.com/',
      seoScore:       82,
      aiScore:        71,
      wordCount:      850,
      responseTimeMs: 340,
      schemaData:     [{ '@type': 'Organization', name: 'Example' }, { '@type': 'WebPage' }],
    },
    {
      url:            'https://example.com/about',
      seoScore:       75,
      aiScore:        68,
      wordCount:      620,
      responseTimeMs: 290,
      schemaData:     [],
    },
    {
      url:            'https://example.com/blog',
      seoScore:       60,
      aiScore:        55,
      wordCount:      210,
      responseTimeMs: 410,
      schemaData:     [],
    },
  ],
  scores: {
    overall:          72,
    seoScore:         78,
    aiScore:          65,
    schemaScore:      55,
    linkGraphScore:   82,
    performanceScore: 71,
    breakdown: {
      seo: {
        titleOptimisation:  80,
        metaOptimisation:   60,
        headingStructure:   75,
        canonicalisation:   90,
        crawlability:       100,
        imageOptimisation:  65,
      },
      ai: {
        entityClarity:           70,
        conversationalReadiness: 62,
        aiExtractability:        68,
        knowledgeGraphStructure: 58,
      },
      performance: {
        lcp:  2.1,
        cls:  0.08,
        ttfb: 420,
      },
    },
  },
  linkGraph: {
    score:           82,
    avgPageRank:     0.042,
    orphanPages:     ['https://example.com/old-page'],
    weakClusters:    [],
    linkSuggestions: [],
    nodes: [
      {
        id: 'https://example.com/', url: 'https://example.com/', label: 'Home',
        pageRank: 0.25, inDegree: 18, inboundCount: 18, outDegree: 12, outboundCount: 12,
        depth: 0, cluster: 'main',
      },
      {
        id: 'https://example.com/about', url: 'https://example.com/about', label: 'About',
        pageRank: 0.08, inDegree: 5, inboundCount: 5, outDegree: 3, outboundCount: 3,
        depth: 1, cluster: 'main',
      },
    ],
    edges: [{ from: 'https://example.com/', to: 'https://example.com/about', weight: 1, anchorText: 'About' }],
  },
};

// Shape matches AuditsResponse in dashboard/page.tsx
const MOCK_AUDITS_LIST = {
  data: [
    {
      id:          MOCK_AUDIT_ID,
      domain:      MOCK_AUDIT_DOMAIN,
      status:      'complete' as const,
      createdAt:   new Date().toISOString(),
      completedAt: new Date().toISOString(),
      scores: {
        overall:          72,
        seoScore:         78,
        aiScore:          65,
        schemaScore:      55,
        linkGraphScore:   82,
        performanceScore: 71,
      },
      _count: { issues: 11 },
    },
  ],
  total:    1,
  page:     1,
  pageSize: 10,
  hasMore:  false,
};

export async function mockAuditAPIs(page: Page): Promise<void> {
  // POST /api/audit/start
  await page.route('**/api/audit/start', async (route) => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ auditId: MOCK_AUDIT_ID }),
    });
  });

  // GET /api/audit/[id]/stream — SSE
  await page.route(`**/api/audit/${MOCK_AUDIT_ID}/stream`, async (route) => {
    const body = SSE_SEQUENCE.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    await route.fulfill({
      status:      200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
      body,
    });
  });

  // DELETE /api/audit/[id]
  await page.route(`**/api/audit/${MOCK_AUDIT_ID}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    } else {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(MOCK_AUDIT_RESULT),
      });
    }
  });

  // GET /api/audits — paginated list (registered first; delete test overrides this later)
  await page.route('**/api/audits**', async (route) => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify(MOCK_AUDITS_LIST),
    });
  });

  // POST /api/audit/[id]/report
  await page.route(`**/api/audit/${MOCK_AUDIT_ID}/report`, async (route) => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ pdfUrl: 'https://example.com/reports/mock-report.pdf' }),
    });
  });
}
