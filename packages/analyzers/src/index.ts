import { type CrawledPage, type AuditScores } from '@sitenexis/shared';
import { analyzeSEO } from './seo/analyzer';
import { calculateSEOScore } from './seo/scoring';
import { analyzeAIReadability } from './ai/readability';
import { analyzeSchema } from './schema/engine';
import { analyzeLinkGraph } from './graph/engine';
import { analyzePerformance } from './performance/engine';
import { analyzeMachineReadability } from './machine-readability/engine';
import { analyzeEntityIntelligence } from './entity/engine';
import { analyzeCitationProbability } from './citation/engine';
import { analyzeSemanticTrust } from './semantic-trust/engine';
import { buildPerceptionGraph } from './perception-graph/engine';

export { analyzeSEO } from './seo/analyzer';
export { calculateSEOScore, getSEOScoreLabel, getSEOScoreColor } from './seo/scoring';
export { analyzeAIReadability } from './ai/readability';
export { analyzeSchema, generateSchemaSnippet } from './schema/engine';
export { analyzeLinkGraph } from './graph/engine';
export { analyzePerformance } from './performance/engine';
export { analyzeContentQuality } from './content/engine';
export { generateAuditReport } from './reports/generator';
export { callAI, callClaude, parseAIResponse, AI_MODEL, CLAUDE_MODEL } from './ai/client';
export {
  entityClarityPrompt,
  conversationalReadinessPrompt,
  aiExtractabilityPrompt,
  entityDetectionPrompt,
  contradictionDetectionPrompt,
} from './ai/prompts';
export { analyzeMachineReadability } from './machine-readability/engine';
export { analyzeEntityIntelligence } from './entity/engine';
export { analyzeCitationProbability } from './citation/engine';
export { analyzeSemanticTrust } from './semantic-trust/engine';
export { buildPerceptionGraph } from './perception-graph/engine';

export async function runAllAnalyzers(
  auditId: string,
  pages: CrawledPage[],
  sitemapUrls: string[] = []
): Promise<AuditScores> {
  const { issues: seoIssues } = analyzeSEO(pages, sitemapUrls);
  const seo = calculateSEOScore(seoIssues, pages.length, { hasValidSitemap: sitemapUrls.length > 0 });

  const linkGraph = analyzeLinkGraph(pages);
  const inDegree = new Map(linkGraph.nodes.map((n) => [n.url, n.inDegree]));

  const machineReadability = analyzeMachineReadability(pages);
  const schema = analyzeSchema(pages);

  // Run AI-dependent analyzers (Claude API) concurrently
  const [aiReadability, entityIntelligence, performance] = await Promise.all([
    analyzeAIReadability(pages),
    analyzeEntityIntelligence(pages),
    analyzePerformance(pages, inDegree),
  ]);

  // Citation and semantic trust depend on entity intelligence
  const [citationAnalysis, semanticTrust] = await Promise.all([
    Promise.resolve(analyzeCitationProbability(pages, entityIntelligence, schema)),
    analyzeSemanticTrust(pages, entityIntelligence, schema),
  ]);

  const perceptionGraph = buildPerceptionGraph(auditId, pages, entityIntelligence);

  const overall = Math.round(
    (seo.score
      + aiReadability.score
      + machineReadability.score
      + schema.score
      + linkGraph.score
      + performance.score
      + entityIntelligence.entityConfidenceScore
      + citationAnalysis.citationProbabilityScore
      + semanticTrust.score) / 9
  );

  return {
    auditId,
    overall,
    seo,
    aiReadability,
    machineReadability,
    schema,
    linkGraph,
    performance,
    entityIntelligence,
    citationAnalysis,
    semanticTrust,
    perceptionGraph,
  };
}
