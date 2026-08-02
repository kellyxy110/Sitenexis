import { describe, expect, it } from 'vitest';
import {
  normalizeCitationIntelligenceModuleState,
  normalizeLegacyModuleState,
  normalizeLegacyModuleStates,
  normalizeScoutModuleState,
} from '@sitenexis/shared';

describe('read-time intelligence module state normalization', () => {
  it('maps explicit completed output with zero evidence without treating it as failure', () => {
    const result = normalizeCitationIntelligenceModuleState({
      status: 'completed',
      availabilityState: 'available_no_evidence',
      providerState: 'available',
      evidenceState: 'no_evidence_found',
      engineVersion: 'citation-v1',
      generatedAt: '2026-08-02T00:00:00.000Z',
      signals: [], gaps: [], scores: { citation: 0 },
    }, { executionMode: 'WORKER', provider: 'serp' });

    expect(result).toMatchObject({
      moduleId: 'citation-intelligence', state: 'COMPLETED', reasonCode: 'NO_EVIDENCE',
      evidenceCount: 0, findingCount: 0, scoreAvailable: true, executionMode: 'WORKER', provider: 'serp',
    });
  });

  it('maps partial and provider-limited output conservatively', () => {
    const result = normalizeLegacyModuleState({
      moduleId: 'information-gain',
      provider: 'serp',
      output: { status: 'partial', providerState: 'failed' },
    });
    expect(result).toMatchObject({ state: 'PARTIAL', reasonCode: 'PROVIDER_ERROR', partial: true });
  });

  it('maps missing credentials, unavailable providers, and missing integrations as unavailable', () => {
    expect(normalizeLegacyModuleState({ moduleId: 'information-gain', providerConfigured: false }))
      .toMatchObject({ state: 'UNAVAILABLE', reasonCode: 'MISSING_CREDENTIAL' });
    expect(normalizeLegacyModuleState({ moduleId: 'information-gain', providerAvailable: false }))
      .toMatchObject({ state: 'UNAVAILABLE', reasonCode: 'PROVIDER_UNAVAILABLE' });
    expect(normalizeCitationIntelligenceModuleState({ status: 'not_configured' }))
      .toMatchObject({ state: 'UNAVAILABLE', reasonCode: 'MISSING_INTEGRATION' });
  });

  it('maps failed dependencies and incomplete inputs to blocked', () => {
    expect(normalizeLegacyModuleState({ moduleId: 'entity-intelligence', dependency: 'failed' }))
      .toMatchObject({ state: 'BLOCKED', reasonCode: 'DEPENDENCY_FAILED' });
    expect(normalizeCitationIntelligenceModuleState({ status: 'no_data', availabilityState: 'unavailable' }))
      .toMatchObject({ state: 'BLOCKED', reasonCode: 'DEPENDENCY_INCOMPLETE' });
  });

  it('maps explicit failure, audit-layer gating, plan gating, and intentional skip separately', () => {
    expect(normalizeLegacyModuleState({ moduleId: 'redlab', output: { status: 'failed' } }))
      .toMatchObject({ state: 'FAILED', reasonCode: 'EXECUTION_FAILED' });
    expect(normalizeLegacyModuleState({ moduleId: 'redlab', auditLayerEligible: false }))
      .toMatchObject({ state: 'INELIGIBLE', reasonCode: 'AUDIT_LAYER_TOO_LOW' });
    expect(normalizeLegacyModuleState({ moduleId: 'redlab', planEligible: false }))
      .toMatchObject({ state: 'INELIGIBLE', reasonCode: 'PLAN_NOT_ELIGIBLE' });
    expect(normalizeLegacyModuleState({ moduleId: 'redlab', intentionallySkipped: true }))
      .toMatchObject({ state: 'SKIPPED', reasonCode: 'EXECUTION_NOT_STARTED' });
  });

  it('maps Scout GTL state and preserves unknown execution mode without guessing', () => {
    expect(normalizeScoutModuleState({ state: 'complete', pagesAnalyzed: 3, recommendations: [] }))
      .toMatchObject({ moduleId: 'scout', state: 'COMPLETED', evidenceCount: 3, findingCount: 0, executionMode: undefined });
    expect(normalizeScoutModuleState({ state: 'partial' }, { executionMode: 'SERVERLESS' }))
      .toMatchObject({ state: 'PARTIAL', reasonCode: 'EXECUTION_PARTIAL', executionMode: 'SERVERLESS' });
    expect(normalizeScoutModuleState({ state: 'empty' }))
      .toMatchObject({ state: 'PARTIAL', reasonCode: 'EXECUTION_NOT_STARTED' });
  });

  it('does not infer completed from an ambiguous legacy row and does not mutate inputs', () => {
    const input = { moduleId: 'ai-governance', output: { version: 'ai-governance-v1', overallScore: 80 } };
    const before = JSON.stringify(input);
    const result = normalizeLegacyModuleState(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result).toMatchObject({ state: 'PARTIAL', reasonCode: 'EXECUTION_NOT_STARTED' });
    expect(result.metadata).toMatchObject({ legacyStateAmbiguous: true });
  });

  it('normalizes caller-supplied collections only and preserves worker, serverless, and unknown modes', () => {
    const results = normalizeLegacyModuleStates([
      { moduleId: 'mrs', output: { state: 'complete' }, executionMode: 'WORKER' },
      { moduleId: 'machine-trust', output: { state: 'partial' }, executionMode: 'SERVERLESS' },
      { moduleId: 'sii', output: { score: 72 } },
    ]);
    expect(results.map((result) => result.state)).toEqual(['COMPLETED', 'PARTIAL', 'PARTIAL']);
    expect(results.map((result) => result.executionMode)).toEqual(['WORKER', 'SERVERLESS', undefined]);
  });
});
