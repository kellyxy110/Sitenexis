import type {
  CrawledPage,
  RecommendationSurfaceMap,
} from '@sitenexis/shared';
import { runRecommendationSurfaceMapping, type AgentProbeResults } from '@sitenexis/analyzers';
import { saveRecommendationSurfaceMap } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

const PROBE_TIMEOUT_MS = 5_000;

/**
 * Probes agent-discoverable endpoints on a domain.
 * Per CLAUDE.md §30: HEAD requests, 5s timeout, 3 concurrent max.
 * On failure marks probeStatus: 'unreachable' — engine uses conservative base estimate.
 */
async function probeAgentDiscovery(domain: string): Promise<AgentProbeResults> {
  const origin = domain.startsWith('http') ? domain : `https://${domain}`;

  async function headOk(url: string): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(timer);
      return res.ok || res.status === 405; // 405 = endpoint exists but HEAD not allowed
    } catch {
      return false;
    }
  }

  async function getRobotsText(): Promise<string> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(`${origin}/robots.txt`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok ? (await res.text()) : '';
    } catch {
      return '';
    }
  }

  try {
    const [wellKnown, openApi, robotsTxt] = await Promise.all([
      headOk(`${origin}/.well-known/ai-plugin.json`),
      headOk(`${origin}/openapi.json`).then((ok) => ok || headOk(`${origin}/api/openapi.json`)),
      getRobotsText(),
    ]);

    const robotsAgentDirectivesFound = /user-agent\s*:\s*(gptbot|claudebot|perplexitybot|bingbot|googlebot|ai2bot)/i.test(robotsTxt);

    return {
      wellKnownExists: wellKnown,
      openApiExists: openApi,
      robotsAgentDirectivesFound,
      probeStatus: 'ok',
    };
  } catch {
    return {
      wellKnownExists: false,
      openApiExists: false,
      robotsAgentDirectivesFound: false,
      probeStatus: 'unreachable',
    };
  }
}

export async function runRecommendationMappingAgent(
  auditId: string,
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
  domain?: string,
): Promise<RecommendationSurfaceMap> {
  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'started' });

  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'progress', payload: { surface: 'ai_overviews' } });
  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'progress', payload: { surface: 'chat_recommendation' } });
  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'progress', payload: { surface: 'voice_retrieval' } });

  // Probe agent-discoverable endpoints (5s timeout per request)
  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'progress', payload: { surface: 'agent_discovery' } });
  const agentProbeResults: AgentProbeResults | undefined = domain
    ? await probeAgentDiscovery(domain).catch(() => undefined)
    : undefined;

  const map = runRecommendationSurfaceMapping(pages, inputs, agentProbeResults);

  await saveRecommendationSurfaceMap(auditId, map);

  await emitAgentEvent({
    auditId,
    agentId: 'recommendation-mapping',
    event: 'completed',
    payload: {
      overallSurfaceScore: map.overallSurfaceScore,
      missingChannelCount: map.missingVisibilityChannels.length,
      probeStatus: agentProbeResults?.probeStatus ?? 'skipped',
    },
  });

  return map;
}
