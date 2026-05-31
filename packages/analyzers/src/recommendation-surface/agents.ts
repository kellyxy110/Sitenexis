import type { CrawledPage, SurfaceScore, SurfaceBlocker } from '@sitenexis/shared';

// Probe results passed in from agent (HEAD requests to /.well-known/ etc.)
export interface AgentProbeResults {
  wellKnownExists: boolean;
  openApiExists: boolean;
  robotsAgentDirectivesFound: boolean;
  probeStatus: 'ok' | 'unreachable';
}

/**
 * Models autonomous agent discovery probability (CLAUDE.md §25 — Surface 4).
 *
 * Trigger conditions: Agent programmatically queries for entity information.
 * Inclusion probability derived from:
 *   Entity Confidence     × 0.35
 *   + Schema Completeness × 0.35
 *   + External Validation × 0.30
 *
 * Agent discovery probe results (HEAD requests) are passed in by the agent.
 * If probeStatus is 'unreachable', conservative estimate (0.2 base) is applied.
 */
export function modelAgentDiscovery(
  pages: CrawledPage[],
  entityConfidenceScore: number,
  schemaCompletenessScore: number,
  externalValidationScore: number,
  probeResults?: AgentProbeResults,
): SurfaceScore {
  const blockers: SurfaceBlocker[] = [];

  // Use conservative base if probe failed
  const probeOk = !probeResults || probeResults.probeStatus === 'ok';
  const conservativeBase = probeOk ? 0 : 0.2;

  let inclusionScore = probeOk
    ? Math.round(
      entityConfidenceScore * 0.35
      + schemaCompletenessScore * 0.35
      + externalValidationScore * 0.30,
    )
    : Math.round(conservativeBase * 100);

  // Machine-readable discovery signals
  const hasWellKnown = probeResults?.wellKnownExists ?? false;
  const hasOpenApi = probeResults?.openApiExists ?? false;
  const hasAgentRobotsDirectives = probeResults?.robotsAgentDirectivesFound ?? false;
  const hasJsonLdOnHomepage = pages.some((p) =>
    (p.schemaMarkup ?? []).length > 0
    && (p.url.replace(/https?:\/\/[^/]+/, '') === '/' || p.url.match(/https?:\/\/[^/]+\/?$/)),
  );

  if (!hasJsonLdOnHomepage) {
    inclusionScore = Math.round(inclusionScore * 0.85);
    blockers.push({
      type: 'no_jsonld_on_homepage',
      description: 'No JSON-LD schema detected on the homepage — autonomous agents cannot extract structured entity data at entry point.',
      recommendation: 'Add Organisation and WebSite schema as JSON-LD to the homepage.',
    });
  }

  if (!hasWellKnown && probeOk) {
    blockers.push({
      type: 'no_well_known_endpoint',
      description: 'No /.well-known/ discovery endpoint found — AI agents cannot programmatically discover service capabilities.',
      recommendation: 'Consider adding /.well-known/ai-plugin.json or similar discovery endpoints for agent compatibility.',
    });
  }

  if (!hasOpenApi && probeOk) {
    blockers.push({
      type: 'no_openapi_spec',
      description: 'No OpenAPI specification endpoint found — agents cannot discover machine-readable service definitions.',
      recommendation: 'Publish an OpenAPI spec if the site offers API endpoints or data services.',
    });
  }

  if (!hasAgentRobotsDirectives && probeOk) {
    blockers.push({
      type: 'no_agent_robots_directives',
      description: 'robots.txt has no explicit agent access directives — AI agents may apply conservative access policies.',
      recommendation: 'Add explicit User-agent directives for AI crawlers in robots.txt to clarify access policy.',
    });
  }

  // Bonuses for machine-readable discovery signals
  if (hasWellKnown) inclusionScore = Math.min(100, Math.round(inclusionScore * 1.1));
  if (hasOpenApi) inclusionScore = Math.min(100, Math.round(inclusionScore * 1.05));

  const inclusionProbability = Math.min(100, Math.max(0, inclusionScore));

  return {
    inclusionProbability,
    status: classifySurfaceStatus(inclusionProbability),
    blockers,
    recommendations: blockers.map((b) => b.recommendation),
  };
}

function classifySurfaceStatus(score: number): SurfaceScore['status'] {
  if (score >= 65) return 'visible';
  if (score >= 35) return 'partial';
  return 'absent';
}
