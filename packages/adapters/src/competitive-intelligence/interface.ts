// CompetitiveIntelligenceCapability — canonical interface for competitive domain analysis.
// Produces structured competitor signal extraction: entity types, schema, topics, link patterns.
// Callers never import Scrapy, Maxun, or any crawling framework directly.

// ── Options ───────────────────────────────────────────────────────────────────

export interface CompetitorAnalysisOptions {
  /** Max pages to crawl per competitor domain; default 50 */
  maxPagesPerDomain?: number;
  /** Extract schema markup; default true */
  includeSchema?: boolean;
  /** Per-domain crawl timeout in ms; default 60 000 */
  timeoutMs?: number;
  /** Parallel requests per domain; default 3 */
  concurrency?: number;
  /** Respect robots.txt; default true */
  respectRobotsTxt?: boolean;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface CompetitorPageSignal {
  url: string;
  title: string | null;
  wordCount: number;
  schemaTypes: string[];
  hasStructuredData: boolean;
  internalLinkCount: number;
  externalLinkCount: number;
  headingDepth: number;       // deepest heading level found (1–6)
  estimatedTopics: string[];  // derived from headings and title
}

export interface CompetitorDomainReport {
  domain: string;
  crawledAt: Date;
  totalPagesAnalyzed: number;
  avgWordCount: number;
  schemaUsageRate: number;    // 0–1: pages with schema / total pages
  topSchemaTypes: string[];   // sorted by frequency
  topTopics: string[];        // sorted by frequency
  avgInternalLinks: number;
  avgHeadingDepth: number;
  pages: CompetitorPageSignal[];
  adapter: string;
  durationMs: number;
}

export interface CompetitiveAnalysisOutput {
  targetDomain: string;
  competitors: CompetitorDomainReport[];
  generatedAt: Date;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface CompetitiveIntelligenceHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  checkedAt: Date;
  details?: string;
}

// ── Adapter contract ──────────────────────────────────────────────────────────

export interface CompetitiveIntelligenceAdapter {
  readonly provider: string;
  /** true = benchmark evaluation only; never enters the production registry */
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  analyzeCompetitors(
    targetDomain: string,
    competitors: string[],
    opts?: CompetitorAnalysisOptions,
  ): Promise<CompetitiveAnalysisOutput>;
  healthCheck(): Promise<CompetitiveIntelligenceHealth>;
}
