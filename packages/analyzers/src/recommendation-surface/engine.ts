import type {
  CrawledPage,
  RecommendationSurfaceMap,
  CoverageGap,
} from '@sitenexis/shared';
import { modelAIOverviewsInclusion } from './overviews';
import { modelChatRecommendation } from './chat';
import { modelVoiceRetrieval } from './voice';
import { modelAgentDiscovery, type AgentProbeResults } from './agents';

export { modelAIOverviewsInclusion } from './overviews';
export { modelChatRecommendation } from './chat';
export { modelVoiceRetrieval } from './voice';
export { modelAgentDiscovery } from './agents';
export type { AgentProbeResults } from './agents';

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Maps recommendation surface coverage across 4 AI recommendation surfaces.
 *
 * Recommendation Surface Score formula (CLAUDE.md §25):
 *   AI Overviews Inclusion Probability    × 0.30
 *   + Chat Recommendation Probability    × 0.30
 *   + Voice Retrieval Probability        × 0.20
 *   + Agent Discovery Probability        × 0.20
 *
 * All surface scores are probabilistic estimates — NOT measured data.
 * The agent labels them as "Estimated [surface] inclusion probability".
 */
export function runRecommendationSurfaceMapping(
  pages: CrawledPage[],
  inputs: {
    retrievalQualityScore: number;
    entityConfidenceScore: number;
    semanticTrustScore: number;
    citationProbabilityScore: number;
    schemaCompletenessScore: number;
    aiExtractabilityScore: number;
    externalValidationScore: number;
  },
  agentProbeResults?: AgentProbeResults,
): RecommendationSurfaceMap {
  const aiOverviews = modelAIOverviewsInclusion(
    pages,
    inputs.retrievalQualityScore,
    inputs.schemaCompletenessScore,
    inputs.citationProbabilityScore,
  );

  const chatRecommendation = modelChatRecommendation(
    pages,
    inputs.aiExtractabilityScore,
    inputs.entityConfidenceScore,
    inputs.semanticTrustScore,
  );

  const voiceRetrieval = modelVoiceRetrieval(
    pages,
    inputs.schemaCompletenessScore,
  );

  const agentDiscovery = modelAgentDiscovery(
    pages,
    inputs.entityConfidenceScore,
    inputs.schemaCompletenessScore,
    inputs.externalValidationScore,
    agentProbeResults,
  );

  // Composite surface score
  const overallSurfaceScore = Math.round(
    aiOverviews.inclusionProbability * 0.30
    + chatRecommendation.inclusionProbability * 0.30
    + voiceRetrieval.inclusionProbability * 0.20
    + agentDiscovery.inclusionProbability * 0.20,
  );

  // Coverage gaps — absent or partial surfaces with high impact
  const coverageGaps: CoverageGap[] = [];

  if (aiOverviews.status !== 'visible') {
    coverageGaps.push({
      surface: 'AI Overviews',
      missedOpportunity: 'Featured snippet and AI Overview appearances for relevant queries.',
      requiredSignals: ['FAQ schema', 'Direct-answer content', 'Featured snippet eligibility'],
      estimatedImpact: aiOverviews.status === 'absent' ? 'high' : 'medium',
    });
  }

  if (chatRecommendation.status !== 'visible') {
    coverageGaps.push({
      surface: 'Chat Recommendation',
      missedOpportunity: 'Organic mentions in ChatGPT, Claude, Gemini, and similar AI assistant responses.',
      requiredSignals: ['Entity confidence ≥70', 'Conversational content structure', 'Clear primary entity definition'],
      estimatedImpact: chatRecommendation.status === 'absent' ? 'high' : 'medium',
    });
  }

  if (voiceRetrieval.status !== 'visible') {
    coverageGaps.push({
      surface: 'Voice Retrieval',
      missedOpportunity: 'Answers to voice queries from Siri, Alexa, Google Assistant, and similar systems.',
      requiredSignals: ['Speakable schema', 'Sub-30-word factual answers', 'LocalBusiness schema for local queries'],
      estimatedImpact: 'medium',
    });
  }

  if (agentDiscovery.status !== 'visible') {
    coverageGaps.push({
      surface: 'Agent Discovery',
      missedOpportunity: 'Programmatic discovery by autonomous AI agents and API-consuming systems.',
      requiredSignals: ['JSON-LD on homepage', '/.well-known/ endpoints', 'Machine-readable entity data'],
      estimatedImpact: 'low',
    });
  }

  // Missing visibility channels (absent surfaces)
  const missingVisibilityChannels = [
    aiOverviews.status === 'absent' && 'AI Overviews',
    chatRecommendation.status === 'absent' && 'Chat-Based AI Assistants',
    voiceRetrieval.status === 'absent' && 'Voice Assistants',
    agentDiscovery.status === 'absent' && 'Autonomous AI Agents',
  ].filter((x): x is string => x !== false);

  return {
    overallSurfaceScore,
    surfaces: {
      aiOverviews,
      chatRecommendation,
      voiceRetrieval,
      agentDiscovery,
    },
    coverageGaps,
    missingVisibilityChannels,
  };
}
