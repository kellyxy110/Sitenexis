import { describe, expect, it } from 'vitest';
import { deriveModuleAndProviderState } from '../intelligence-report-v2-modules';

describe('deriveModuleAndProviderState', () => {
  it('produces no module or provider state at all when the audit has no stored agent manifest (genuinely absent, not fabricated)', () => {
    const result = deriveModuleAndProviderState({});
    expect(result.modules).toEqual([]);
    expect(result.providers).toEqual([]);
  });

  it('produces no module state for an empty manifest agents map', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: {} } });
    expect(result.modules).toEqual([]);
    expect(result.providers).toEqual([]);
  });

  it('normalizes a completed generic agent using its real stored timing', () => {
    const result = deriveModuleAndProviderState({
      agentManifest: { agents: { seo: { agent: 'seo', status: 'completed', startedAt: '2026-08-01T00:00:00.000Z', finishedAt: '2026-08-01T00:01:00.000Z', durationMs: 60000, retryCount: 0 } } },
    });
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]).toMatchObject({ moduleId: 'seo', state: 'COMPLETED', startedAt: '2026-08-01T00:00:00.000Z', completedAt: '2026-08-01T00:01:00.000Z', durationMs: 60000 });
  });

  it('normalizes a partial agent as PARTIAL, not a fabricated failure', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: { retrieval: { agent: 'retrieval', status: 'partial' } } } });
    expect(result.modules[0]).toMatchObject({ moduleId: 'retrieval', state: 'PARTIAL' });
  });

  it('normalizes a failed agent as FAILED', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: { performance: { agent: 'performance', status: 'failed' } } } });
    expect(result.modules[0]).toMatchObject({ moduleId: 'performance', state: 'FAILED' });
  });

  it('normalizes a not_configured agent as UNAVAILABLE and also emits a matching ProviderAvailability entry', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: { citation: { agent: 'citation', status: 'not_configured' } } } });
    expect(result.modules[0]).toMatchObject({ moduleId: 'citation-intelligence', state: 'UNAVAILABLE' });
    expect(result.providers).toEqual([{
      provider: 'citation', available: false, configured: false, reasonCode: 'MISSING_INTEGRATION',
      reason: expect.stringContaining('citation'),
    }]);
  });

  it('routes the citation agent through the citation-intelligence normalizer and uses the real stored citationProbabilityScore', () => {
    const result = deriveModuleAndProviderState({
      agentManifest: { agents: { citation: { agent: 'citation', status: 'completed' } } },
      citationProbabilityScore: 62,
    });
    expect(result.modules[0]).toMatchObject({ moduleId: 'citation-intelligence', state: 'COMPLETED', scoreAvailable: true });
  });

  it('does not claim a citation score is available when none was stored', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: { citation: { agent: 'citation', status: 'completed' } } } });
    expect(result.modules[0]).toMatchObject({ scoreAvailable: false });
  });

  it('routes the scout agent through the scout normalizer using the real stored ScoutAnalysis row', () => {
    const result = deriveModuleAndProviderState({
      agentManifest: { agents: { scout: { agent: 'scout', status: 'completed' } } },
      scoutAnalysis: {
        state: 'complete', timestamp: '2026-08-01T00:02:00.000Z', domain: 'example.com', pagesAnalyzed: 12,
        pageIntents: [], intentDistribution: [], dominantIntent: 'informational', intentCoverageScore: 70, intentAlignmentScore: 70,
        recommendations: ['a', 'b'],
        pipeline: {
          ingestion: { status: 'complete', detail: 'ok' },
          embedding: { status: 'skipped', detail: 'deferred' },
          reasoning: { status: 'complete', detail: 'ok' },
          memoryWriteback: { status: 'complete', detail: 'ok' },
        },
      },
    });
    expect(result.modules[0]).toMatchObject({ moduleId: 'scout', state: 'COMPLETED', completedAt: '2026-08-01T00:02:00.000Z', evidenceCount: 12, findingCount: 2 });
  });

  it('normalizes the scout agent as ambiguous PARTIAL when no ScoutAnalysis row was found, rather than claiming completion or failure', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: { scout: { agent: 'scout', status: 'completed' } } } });
    expect(result.modules[0]?.state).toBe('PARTIAL');
  });

  it('ignores an agent entry with an unrecognized/corrupt status instead of guessing its state', () => {
    const result = deriveModuleAndProviderState({ agentManifest: { agents: { seo: { agent: 'seo', status: 'totally-unexpected' } } } });
    expect(result.modules).toEqual([]);
  });

  it('handles multiple agents independently and preserves per-agent moduleId', () => {
    const result = deriveModuleAndProviderState({
      agentManifest: { agents: {
        seo: { agent: 'seo', status: 'completed' },
        schema: { agent: 'schema', status: 'partial' },
        performance: { agent: 'performance', status: 'not_applicable' },
      } },
    });
    expect(result.modules.map((m) => m.moduleId).sort()).toEqual(['performance', 'schema', 'seo']);
    expect(result.modules.find((m) => m.moduleId === 'performance')?.state).toBe('INELIGIBLE');
  });

  it('is pure: does not mutate the supplied manifest', () => {
    const manifest = { agents: { seo: { agent: 'seo', status: 'completed' } } };
    const before = JSON.stringify(manifest);
    deriveModuleAndProviderState({ agentManifest: manifest });
    expect(JSON.stringify(manifest)).toBe(before);
  });
});
