// ScrapyCompetitiveAdapter — HTTP bridge to a Python Scrapy microservice.
// Scrapy provides structured, rule-driven competitive crawling with item pipelines.
// When SCRAPY_SERVICE_URL is not set, isConfigured() returns false.
//
// To run the Scrapy service:
//   pip install scrapy fastapi uvicorn
//   uvicorn sitenexis_scrapy.server:app --port 11236
//
// Expected API:
//   POST /analyze  { target_domain, competitors: string[], options: {} }
//   GET  /health

import type {
  CompetitiveIntelligenceAdapter,
  CompetitorAnalysisOptions,
  CompetitiveAnalysisOutput,
  CompetitorDomainReport,
  CompetitorPageSignal,
  CompetitiveIntelligenceHealth,
} from './interface';

// ─── Response shape from Scrapy service ──────────────────────────────────────

interface ScrapyPageItem {
  url: string;
  title?: string | null;
  word_count?: number;
  schema_types?: string[];
  has_structured_data?: boolean;
  internal_link_count?: number;
  external_link_count?: number;
  heading_depth?: number;
  topics?: string[];
}

interface ScrapyDomainResult {
  domain: string;
  crawled_at?: string;
  pages: ScrapyPageItem[];
  duration_ms?: number;
}

interface ScrapyAnalysisResponse {
  target_domain: string;
  competitors: ScrapyDomainResult[];
  generated_at?: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapPage(item: ScrapyPageItem): CompetitorPageSignal {
  return {
    url: item.url,
    title: item.title ?? null,
    wordCount: item.word_count ?? 0,
    schemaTypes: item.schema_types ?? [],
    hasStructuredData: item.has_structured_data ?? false,
    internalLinkCount: item.internal_link_count ?? 0,
    externalLinkCount: item.external_link_count ?? 0,
    headingDepth: item.heading_depth ?? 1,
    estimatedTopics: item.topics ?? [],
  };
}

function mapDomain(r: ScrapyDomainResult): CompetitorDomainReport {
  const pages = r.pages.map(mapPage);
  const total = pages.length || 1;
  const avgWordCount = Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / total);
  const avgInternalLinks = Math.round(pages.reduce((s, p) => s + p.internalLinkCount, 0) / total);
  const avgHeadingDepth = Math.round(pages.reduce((s, p) => s + p.headingDepth, 0) / total);
  const pagesWithSchema = pages.filter((p) => p.hasStructuredData).length;
  const schemaUsageRate = pages.length > 0 ? pagesWithSchema / pages.length : 0;

  // Frequency-rank schema types and topics
  const schemaFreq: Record<string, number> = {};
  const topicFreq: Record<string, number> = {};
  for (const p of pages) {
    for (const t of p.schemaTypes) schemaFreq[t] = (schemaFreq[t] ?? 0) + 1;
    for (const t of p.estimatedTopics) topicFreq[t] = (topicFreq[t] ?? 0) + 1;
  }
  const rank = (freq: Record<string, number>) =>
    Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);

  return {
    domain: r.domain,
    crawledAt: r.crawled_at ? new Date(r.crawled_at) : new Date(),
    totalPagesAnalyzed: pages.length,
    avgWordCount,
    schemaUsageRate,
    topSchemaTypes: rank(schemaFreq),
    topTopics: rank(topicFreq),
    avgInternalLinks,
    avgHeadingDepth,
    pages,
    adapter: 'scrapy',
    durationMs: r.duration_ms ?? 0,
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class ScrapyCompetitiveAdapter implements CompetitiveIntelligenceAdapter {
  readonly provider = 'scrapy';
  readonly benchmarkOnly = false;
  private readonly serviceUrl: string;

  constructor(serviceUrl?: string) {
    this.serviceUrl = (serviceUrl ?? process.env['SCRAPY_SERVICE_URL'] ?? '').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return this.serviceUrl.length > 0;
  }

  async analyzeCompetitors(
    targetDomain: string,
    competitors: string[],
    opts?: CompetitorAnalysisOptions,
  ): Promise<CompetitiveAnalysisOutput> {
    if (!this.isConfigured()) {
      throw new Error('ScrapyCompetitiveAdapter: SCRAPY_SERVICE_URL is not configured');
    }

    const timeoutMs = (opts?.timeoutMs ?? 60_000) * (competitors.length + 1);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.serviceUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_domain: targetDomain,
          competitors,
          options: {
            max_pages_per_domain: opts?.maxPagesPerDomain ?? 50,
            include_schema: opts?.includeSchema ?? true,
            concurrency: opts?.concurrency ?? 3,
            respect_robots_txt: opts?.respectRobotsTxt ?? true,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Scrapy service returned ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json() as ScrapyAnalysisResponse;
      return {
        targetDomain: data.target_domain,
        competitors: (data.competitors ?? []).map(mapDomain),
        generatedAt: data.generated_at ? new Date(data.generated_at) : new Date(),
      };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async healthCheck(): Promise<CompetitiveIntelligenceHealth> {
    if (!this.isConfigured()) {
      return { provider: 'scrapy', status: 'unavailable', latencyMs: 0, checkedAt: new Date(), details: 'SCRAPY_SERVICE_URL not configured' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`${this.serviceUrl}/health`, { signal: AbortSignal.timeout(5_000) });
      const latencyMs = Date.now() - start;
      if (res.ok) return { provider: 'scrapy', status: 'healthy', latencyMs, checkedAt: new Date() };
      return { provider: 'scrapy', status: 'degraded', latencyMs, checkedAt: new Date(), details: `HTTP ${res.status}` };
    } catch (err) {
      return { provider: 'scrapy', status: 'unavailable', latencyMs: Date.now() - start, checkedAt: new Date(), details: err instanceof Error ? err.message : String(err) };
    }
  }
}

let _instance: ScrapyCompetitiveAdapter | undefined;

export function getScrapyCompetitiveAdapter(serviceUrl?: string): ScrapyCompetitiveAdapter {
  if (!_instance || serviceUrl) _instance = new ScrapyCompetitiveAdapter(serviceUrl);
  return _instance;
}
