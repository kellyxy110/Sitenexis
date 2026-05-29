/**
 * In-memory demo store for when Supabase / DB are not configured.
 * Persists for the lifetime of the Next.js server process.
 * Used by all API routes when isSupabaseConfigured() === false.
 */


export interface DemoAudit {
  id: string;
  userId: string;
  domain: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  pageCount: number | null;
  createdAt: string;
  completedAt: string | null;
  scores: DemoScores | null;
  issues: DemoIssue[];
  pages: DemoPage[];
  linkGraph: DemoLinkGraph | null;
}

export interface DemoScores {
  overall: number;
  seoScore: number;
  aiScore: number;
  schemaScore: number;
  linkGraphScore: number;
  performanceScore: number;
  breakdown: {
    seo: {
      titleOptimisation: number;
      metaOptimisation: number;
      headingStructure: number;
      canonicalisation: number;
      crawlability: number;
      imageOptimisation: number;
    };
    ai: {
      entityClarity: number;
      conversationalReadiness: number;
      aiExtractability: number;
      knowledgeGraphStructure: number;
    };
    machineReadability?: {
      renderingFidelity: number;
      boilerplateRatio: number;
      chunkBoundaryQuality: number;
      signalToNoiseRatio: number;
      headingHierarchy: number;
      readingOrderConsistency: number;
      linkAnchorQuality: number;
    };
    entityIntelligence?: {
      entityConfidenceScore: number;
      entityConsistencyScore: number;
      entityCoverageScore: number;
      disambiguationScore: number;
    };
    citationAnalysis?: {
      citationProbabilityScore: number;
    };
    semanticTrust?: {
      score: number;
      breakdown: {
        authorshipTrust: number;
        organisationalTrust: number;
        contentTrust: number;
        structuralTrust: number;
      };
    };
    performance: {
      lcp: number | null;
      cls: number | null;
      ttfb: number | null;
    };
  };
}

export interface DemoIssue {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  url: string;
  recommendation: string;
  module?: string;
}

export interface DemoPage {
  url: string;
  seoScore: number | null;
  aiScore: number | null;
  wordCount: number;
  responseTimeMs: number;
  schemaData: unknown[];
}

export interface DemoLinkGraph {
  score: number;
  nodes: Array<{
    url: string; id: string; label: string;
    pageRank: number;
    inDegree: number; inboundCount: number;
    outDegree: number; outboundCount: number;
    depth: number; cluster: string;
  }>;
  edges: Array<{ from: string; to: string; source: string; target: string; weight: number }>;
  orphanPages: string[];
  weakClusters: string[][];
  avgPageRank: number;
  linkSuggestions: Array<{ from: string; to: string; reason: string }>;
}

export const DEMO_USER = { id: 'demo-user-id', email: 'demo@sitenexis.com' };

// Global audit map (lives for the process lifetime)
const audits = new Map<string, DemoAudit>();

export function createDemoAudit(domain: string): DemoAudit {
  const id = crypto.randomUUID();
  const audit: DemoAudit = {
    id,
    userId: DEMO_USER.id,
    domain,
    status: 'queued',
    pageCount: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    scores: null,
    issues: [],
    pages: [],
    linkGraph: null,
  };
  audits.set(id, audit);
  return audit;
}

export function getDemoAudit(id: string): DemoAudit | undefined {
  return audits.get(id);
}

export function updateDemoAudit(id: string, patch: Partial<DemoAudit>): void {
  const existing = audits.get(id);
  if (existing) audits.set(id, { ...existing, ...patch });
}

export function listDemoAudits(): DemoAudit[] {
  return [...audits.values()]
    .filter((a) => a.userId === DEMO_USER.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── Demo result generator ────────────────────────────────────────────────────

function rnd(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min);
}

export function buildDemoResults(domain: string): Omit<DemoAudit, 'id' | 'userId' | 'domain' | 'status' | 'createdAt'> {
  const baseUrl = `https://${domain}`;

  const pages: DemoPage[] = [
    { url: baseUrl + '/',             seoScore: rnd(60, 85), aiScore: rnd(55, 80), wordCount: rnd(400, 1200), responseTimeMs: rnd(200, 600), schemaData: [{ '@type': 'WebSite' }] },
    { url: baseUrl + '/about',        seoScore: rnd(50, 75), aiScore: rnd(45, 75), wordCount: rnd(300, 800),  responseTimeMs: rnd(180, 500), schemaData: [{ '@type': 'Organization' }] },
    { url: baseUrl + '/services',     seoScore: rnd(55, 80), aiScore: rnd(50, 78), wordCount: rnd(250, 700),  responseTimeMs: rnd(200, 550), schemaData: [] },
    { url: baseUrl + '/contact',      seoScore: rnd(45, 70), aiScore: rnd(40, 65), wordCount: rnd(100, 300),  responseTimeMs: rnd(190, 480), schemaData: [{ '@type': 'ContactPage' }] },
    { url: baseUrl + '/blog',         seoScore: rnd(60, 85), aiScore: rnd(55, 80), wordCount: rnd(500, 1500), responseTimeMs: rnd(220, 620), schemaData: [] },
    { url: baseUrl + '/faq',          seoScore: rnd(65, 88), aiScore: rnd(60, 85), wordCount: rnd(600, 1800), responseTimeMs: rnd(200, 480), schemaData: [{ '@type': 'FAQPage' }] },
    { url: baseUrl + '/privacy',      seoScore: rnd(30, 55), aiScore: rnd(25, 50), wordCount: rnd(800, 2000), responseTimeMs: rnd(150, 350), schemaData: [] },
    { url: baseUrl + '/terms',        seoScore: rnd(25, 50), aiScore: rnd(20, 45), wordCount: rnd(900, 2200), responseTimeMs: rnd(160, 380), schemaData: [] },
  ];

  const seo = {
    titleOptimisation:  rnd(50, 90),
    metaOptimisation:   rnd(40, 85),
    headingStructure:   rnd(55, 88),
    canonicalisation:   rnd(60, 92),
    crawlability:       rnd(70, 95),
    imageOptimisation:  rnd(30, 75),
  };
  const ai = {
    entityClarity:             rnd(45, 82),
    conversationalReadiness:   rnd(40, 78),
    aiExtractability:          rnd(50, 85),
    knowledgeGraphStructure:   rnd(35, 75),
  };
  const perf = {
    lcp:  parseFloat((Math.random() * 3 + 1).toFixed(1)),
    cls:  parseFloat((Math.random() * 0.2).toFixed(2)),
    ttfb: rnd(200, 1200),
  };

  const seoScore        = Math.round(Object.values(seo).reduce((s, v) => s + v, 0) / 6);
  const aiScore         = Math.round(Object.values(ai).reduce((s, v) => s + v, 0) / 4);
  const schemaScore     = rnd(40, 82);
  const linkGraphScore  = rnd(50, 85);
  const performanceScore = perf.lcp <= 2.5 && perf.cls <= 0.1 ? rnd(70, 95) : rnd(35, 65);

  const machineReadability = {
    renderingFidelity:      rnd(65, 95),
    boilerplateRatio:       rnd(55, 90),
    chunkBoundaryQuality:   rnd(50, 88),
    signalToNoiseRatio:     rnd(60, 92),
    headingHierarchy:       rnd(55, 90),
    readingOrderConsistency: rnd(60, 88),
    linkAnchorQuality:      rnd(45, 80),
  };
  const entityIntelligence = {
    entityConfidenceScore:  rnd(45, 82),
    entityConsistencyScore: rnd(50, 85),
    entityCoverageScore:    rnd(40, 78),
    disambiguationScore:    rnd(35, 75),
  };
  const citationAnalysis = {
    citationProbabilityScore: rnd(40, 78),
  };
  const semanticTrust = {
    score: rnd(45, 80),
    breakdown: {
      authorshipTrust:      rnd(30, 75),
      organisationalTrust:  rnd(40, 85),
      contentTrust:         rnd(45, 80),
      structuralTrust:      rnd(50, 88),
    },
  };

  const overall = Math.round((seoScore + aiScore + schemaScore + linkGraphScore + performanceScore) / 5);

  const issues: DemoIssue[] = [
    { id: '1', type: 'missing_meta_description', severity: 'warning',  message: 'Meta description missing on 3 pages', url: baseUrl + '/services', recommendation: 'Add unique meta descriptions to all key pages to improve click-through rates from search results.', module: 'seo' },
    { id: '2', type: 'missing_h1',               severity: 'critical', message: 'H1 tag missing on homepage',           url: baseUrl + '/',        recommendation: 'Add a clear H1 tag that includes your primary keyword and describes the page purpose.', module: 'seo' },
    { id: '3', type: 'thin_content',              severity: 'warning',  message: 'Contact page has fewer than 150 words', url: baseUrl + '/contact', recommendation: 'Expand contact page content with location information, business hours, and service area.', module: 'seo' },
    { id: '4', type: 'missing_schema',            severity: 'warning',  message: 'Services page lacks structured data',  url: baseUrl + '/services', recommendation: 'Add Service or LocalBusiness schema to help AI systems understand your offerings.', module: 'schema' },
    { id: '5', type: 'low_entity_clarity',        severity: 'warning',  message: 'Primary entity not clearly defined in body text', url: baseUrl + '/', recommendation: 'Define your organisation name, type, and location explicitly in the homepage body text.', module: 'seo' },
    { id: '6', type: 'missing_faq_schema',        severity: 'info',     message: 'FAQ content present but no FAQPage schema', url: baseUrl + '/faq', recommendation: 'Add FAQPage schema markup to improve AI extractability and voice search eligibility.', module: 'schema' },
    { id: '7', type: 'slow_lcp',                  severity: perf.lcp > 2.5 ? 'critical' : 'info', message: `LCP is ${perf.lcp}s — ${perf.lcp > 4 ? 'poor' : perf.lcp > 2.5 ? 'needs improvement' : 'good'}`, url: baseUrl + '/', recommendation: 'Optimise hero image size and enable lazy loading. Consider a CDN for static assets.', module: 'performance' },
    { id: '8', type: 'no_sitemap',                severity: 'critical', message: 'No XML sitemap detected',              url: baseUrl + '/sitemap.xml', recommendation: 'Generate and submit an XML sitemap to improve crawl coverage and indexation speed.', module: 'seo' },
    { id: '9', type: 'missing_canonical',         severity: 'warning',  message: 'Canonical tags absent on blog pages',  url: baseUrl + '/blog', recommendation: 'Add canonical tags to all blog posts to prevent duplicate content issues.', module: 'seo' },
    { id: '10', type: 'ai_chunk_fragmentation',   severity: 'warning',  message: 'Several pages have fragmented semantic chunks', url: baseUrl + '/services', recommendation: 'Restructure content into clearly bounded sections with descriptive headings for better AI chunk extraction.', module: 'seo' },
  ];

  const nodeUrls = pages.map((p) => p.url);

  function urlLabel(url: string): string {
    try { return new URL(url).pathname.replace(/^\//, '') || 'home'; } catch { return url; }
  }

  const nodePageRanks = pages.map((_, i) => parseFloat((Math.random() * 0.8 + (i === 0 ? 0.6 : 0.1)).toFixed(3)));
  const inboundCounts = pages.map((_, i) => rnd(i === 0 ? 5 : 0, i === 0 ? 12 : 5));
  const outboundCounts = pages.map(() => rnd(2, 8));

  const linkGraph: DemoLinkGraph = {
    score: linkGraphScore,
    nodes: pages.map((p, i) => ({
      url:           p.url,
      id:            p.url,
      label:         urlLabel(p.url),
      pageRank:      nodePageRanks[i],
      inDegree:      inboundCounts[i],
      inboundCount:  inboundCounts[i],
      outDegree:     outboundCounts[i],
      outboundCount: outboundCounts[i],
      depth:         i === 0 ? 0 : 1,
      cluster:       i < 5 ? 'main' : 'secondary',
    })),
    edges: [
      { from: nodeUrls[0], to: nodeUrls[1], source: nodeUrls[0], target: nodeUrls[1], weight: 3 },
      { from: nodeUrls[0], to: nodeUrls[2], source: nodeUrls[0], target: nodeUrls[2], weight: 3 },
      { from: nodeUrls[0], to: nodeUrls[3], source: nodeUrls[0], target: nodeUrls[3], weight: 2 },
      { from: nodeUrls[0], to: nodeUrls[4], source: nodeUrls[0], target: nodeUrls[4], weight: 4 },
      { from: nodeUrls[1], to: nodeUrls[0], source: nodeUrls[1], target: nodeUrls[0], weight: 2 },
      { from: nodeUrls[1], to: nodeUrls[2], source: nodeUrls[1], target: nodeUrls[2], weight: 1 },
      { from: nodeUrls[2], to: nodeUrls[0], source: nodeUrls[2], target: nodeUrls[0], weight: 2 },
      { from: nodeUrls[2], to: nodeUrls[3], source: nodeUrls[2], target: nodeUrls[3], weight: 1 },
      { from: nodeUrls[4], to: nodeUrls[0], source: nodeUrls[4], target: nodeUrls[0], weight: 2 },
      { from: nodeUrls[4], to: nodeUrls[5], source: nodeUrls[4], target: nodeUrls[5], weight: 2 },
    ],
    orphanPages: [nodeUrls[6], nodeUrls[7]],
    weakClusters: [[nodeUrls[3], nodeUrls[6]], [nodeUrls[7]]],
    avgPageRank: parseFloat((nodePageRanks.reduce((s, v) => s + v, 0) / nodePageRanks.length).toFixed(3)),
    linkSuggestions: [
      { from: nodeUrls[2], to: nodeUrls[5], reason: 'Services page should link to FAQ — both cover similar questions.' },
      { from: nodeUrls[3], to: nodeUrls[2], reason: 'Contact page should link to Services to guide visitors.' },
      { from: nodeUrls[1], to: nodeUrls[4], reason: 'About page should link to Blog to showcase expertise.' },
    ],
  };

  return {
    pageCount: pages.length,
    completedAt: new Date().toISOString(),
    scores: {
      overall,
      seoScore,
      aiScore,
      schemaScore,
      linkGraphScore,
      performanceScore,
      breakdown: { seo, ai, machineReadability, entityIntelligence, citationAnalysis, semanticTrust, performance: perf },
    },
    issues,
    pages,
    linkGraph,
  };
}
