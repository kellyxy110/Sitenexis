/**
 * Generates realistic demo health data for the self-audit dashboard
 * when the app is running in demo mode (no DB configured).
 */

export interface HealthRunSummary {
  id: string;
  domain: string;
  triggeredBy: 'deploy' | 'cron' | 'manual';
  status: 'complete';
  healthScore: number;
  technicalSeoScore: number;
  aiVisibilityScore: number;
  entityCoverageScore: number;
  citationReadinessScore: number;
  knowledgeGraphScore: number;
  trustSignalsScore: number;
  performanceScore: number;
  geoScore: number;
  startedAt: string;
  completedAt: string;
  crawlRun: {
    pagesFound: number; pagesCrawled: number; pagesIndexable: number;
    crawlDurationMs: number; brokenLinksCount: number; redirectChainCount: number;
    missingSitemapPages: number; crawlHealthScore: number; topIssues: unknown[];
  };
  visibilityRun: {
    aiVisibilityScore: number; machineReadabilityScore: number;
    retrievalReadinessScore: number; citationProbability: number;
    semanticTrustScore: number; recommendationConfidence: number;
    retrievalQualityScore: number; surfaceCoverageScore: number;
    providerBreakdown: Record<string, unknown>;
  };
  entityRun: {
    entitiesDetected: number; primaryEntityName: string;
    entityConfidenceScore: number; entityConsistencyScore: number;
    entityCoverageScore: number; disambiguationScore: number;
    sameAsLinksCount: number; authenticityScore: number; topEntities: unknown[];
  };
  knowledgeGraphRun: {
    nodeCount: number; edgeCount: number; topicClusters: number;
    avgNodeConfidence: number; graphStrengthScore: number; topNodes: unknown[];
  };
  recommendations: Array<{
    dimension: string; severity: string; issue: string;
    impact: string; fix: string; estimatedImprovement: number;
  }>;
}

export function buildDemoHealthData(): { run: HealthRunSummary } {
  const now = new Date();
  const completedAt = new Date(now.getTime() - 4 * 60000);

  return {
    run: {
      id: 'demo-run-latest',
      domain: 'sitenexis.com',
      triggeredBy: 'deploy',
      status: 'complete',
      healthScore: 82,
      technicalSeoScore: 88,
      aiVisibilityScore: 79,
      entityCoverageScore: 75,
      citationReadinessScore: 71,
      knowledgeGraphScore: 84,
      trustSignalsScore: 86,
      performanceScore: 91,
      geoScore: 73,
      startedAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      completedAt: completedAt.toISOString(),
      crawlRun: {
        pagesFound: 47, pagesCrawled: 47, pagesIndexable: 45,
        crawlDurationMs: 38200, brokenLinksCount: 0, redirectChainCount: 2,
        missingSitemapPages: 1, crawlHealthScore: 88, topIssues: [],
      },
      visibilityRun: {
        aiVisibilityScore: 79, machineReadabilityScore: 82,
        retrievalReadinessScore: 77, citationProbability: 71,
        semanticTrustScore: 86, recommendationConfidence: 74,
        retrievalQualityScore: 75, surfaceCoverageScore: 68,
        providerBreakdown: {
          googleAIOverviews: 72, chatGPT: 68, perplexity: 74, gemini: 70, claude: 76,
        },
      },
      entityRun: {
        entitiesDetected: 12, primaryEntityName: 'SiteNexis',
        entityConfidenceScore: 75, entityConsistencyScore: 81,
        entityCoverageScore: 73, disambiguationScore: 78,
        sameAsLinksCount: 3, authenticityScore: 96,
        topEntities: [
          { name: 'SiteNexis', type: 'Organization', confidence: 0.95 },
          { name: 'AI Visibility', type: 'Concept', confidence: 0.82 },
          { name: 'Machine Trust', type: 'Concept', confidence: 0.79 },
        ],
      },
      knowledgeGraphRun: {
        nodeCount: 34, edgeCount: 58, topicClusters: 5,
        avgNodeConfidence: 0.76, graphStrengthScore: 84,
        topNodes: [
          { label: 'SiteNexis', type: 'entity', confidence: 0.95, citationReadiness: 0.82 },
          { label: 'AI Retrieval', type: 'topic', confidence: 0.88, citationReadiness: 0.79 },
          { label: 'Machine Trust', type: 'topic', confidence: 0.84, citationReadiness: 0.76 },
          { label: 'Entity Intelligence', type: 'topic', confidence: 0.81, citationReadiness: 0.72 },
        ],
      },
      recommendations: [
        {
          dimension: 'citation_readiness',
          severity: 'warning',
          issue: 'Citation probability score is 71/100 — above average but improvable.',
          impact: 'AI systems that generate responses with citations prefer content with higher factual density and specific verifiable claims.',
          fix: 'Add more specific statistics, research references, and dated factual claims to blog posts and key landing pages.',
          estimatedImprovement: 8,
        },
        {
          dimension: 'entity_coverage',
          severity: 'warning',
          issue: 'Primary entity has 3 sameAs links — below the recommended 5+ for strong external validation.',
          impact: 'AI knowledge graph integration is weakened without broad external entity validation.',
          fix: 'Add sameAs links to Wikidata, Crunchbase, and industry directory listings in Organization schema.',
          estimatedImprovement: 6,
        },
        {
          dimension: 'ai_visibility',
          severity: 'info',
          issue: 'Surface coverage score is 68/100 — voice retrieval and agent discovery surfaces are underserved.',
          impact: 'Voice assistants and autonomous AI agents represent growing recommendation surfaces that SiteNexis should occupy as the benchmark.',
          fix: 'Add speakable schema to key informational pages. Publish /.well-known/ai-plugin.json for agent discovery.',
          estimatedImprovement: 5,
        },
      ],
    },
  };
}

interface HistorySeries {
  date: string;
  healthScore: number;
  technicalSeoScore: number;
  aiVisibilityScore: number;
  entityCoverageScore: number;
  citationReadinessScore: number;
  knowledgeGraphScore: number;
  trustSignalsScore: number;
  performanceScore: number;
  geoScore: number;
}

export function buildDemoHistoryData(windowDays: number): { window: number; series: HistorySeries[] } {
  const now = Date.now();
  const points = Math.min(windowDays, windowDays === 7 ? 7 : windowDays === 30 ? 12 : 18);
  const intervalMs = (windowDays * 86_400_000) / points;

  const series: HistorySeries[] = Array.from({ length: points }, (_, i) => {
    const jitter = () => Math.round((Math.random() - 0.5) * 6);
    const date = new Date(now - (points - 1 - i) * intervalMs);
    return {
      date: date.toISOString(),
      healthScore: 76 + Math.round(i * 6 / points) + jitter(),
      technicalSeoScore: 82 + jitter(),
      aiVisibilityScore: 72 + Math.round(i * 7 / points) + jitter(),
      entityCoverageScore: 68 + Math.round(i * 7 / points) + jitter(),
      citationReadinessScore: 65 + Math.round(i * 6 / points) + jitter(),
      knowledgeGraphScore: 78 + jitter(),
      trustSignalsScore: 84 + jitter(),
      performanceScore: 88 + jitter(),
      geoScore: 67 + Math.round(i * 6 / points) + jitter(),
    };
  });

  return { window: windowDays, series };
}
