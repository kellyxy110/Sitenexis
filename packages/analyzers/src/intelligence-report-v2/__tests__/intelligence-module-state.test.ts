import { describe, expect, it } from 'vitest';
import {
  INTELLIGENCE_MODULE_REASON_CODES,
  INTELLIGENCE_MODULE_STATES,
  isActiveIntelligenceModuleState,
  isIntelligenceExecutionMode,
  isIntelligenceModuleReasonCode,
  isIntelligenceModuleRequirementType,
  isIntelligenceModuleState,
  isNoEvidenceCompletion,
  isTerminalIntelligenceModuleState,
  validateIntelligenceModuleExecutionSummary,
  type IntelligenceModuleDependency,
  type IntelligenceModuleDescriptor,
  type IntelligenceModuleExecutionSummary,
  type IntelligenceModuleRequirement,
  type ProviderAvailability,
} from '@sitenexis/shared';

describe('Intelligence Module State contracts', () => {
  it('recognizes every canonical state and rejects invalid state values', () => {
    expect(INTELLIGENCE_MODULE_STATES).toEqual([
      'REGISTERED', 'INELIGIBLE', 'READY', 'QUEUED', 'RUNNING', 'COMPLETED',
      'PARTIAL', 'BLOCKED', 'UNAVAILABLE', 'FAILED', 'SKIPPED', 'STALE',
    ]);
    expect(isIntelligenceModuleState('COMPLETED')).toBe(true);
    expect(isIntelligenceModuleState('EMPTY')).toBe(false);
    expect(isActiveIntelligenceModuleState('RUNNING')).toBe(true);
    expect(isTerminalIntelligenceModuleState('PARTIAL')).toBe(true);
  });

  it('recognizes credential, dependency, provider, layer, evidence, and execution reason codes', () => {
    for (const code of [
      'MISSING_CREDENTIAL', 'DEPENDENCY_FAILED', 'PROVIDER_UNAVAILABLE',
      'AUDIT_LAYER_TOO_LOW', 'NO_APPLICABLE_PAGES', 'NO_EVIDENCE', 'EXECUTION_FAILED',
    ] as const) {
      expect(INTELLIGENCE_MODULE_REASON_CODES).toContain(code);
      expect(isIntelligenceModuleReasonCode(code)).toBe(true);
    }
    expect(isIntelligenceModuleReasonCode('NO_DATA')).toBe(false);
  });

  it('keeps completed no-evidence output distinct from failure', () => {
    const summary: IntelligenceModuleExecutionSummary = {
      moduleId: 'citation-intelligence',
      state: 'COMPLETED',
      reasonCode: 'NO_EVIDENCE',
      evidenceCount: 0,
      findingCount: 0,
    };

    expect(isNoEvidenceCompletion(summary)).toBe(true);
    expect(validateIntelligenceModuleExecutionSummary(summary)).toEqual([]);
  });

  it('keeps partial, failed, blocked, unavailable, skipped, and ineligible states distinct', () => {
    const summaries: IntelligenceModuleExecutionSummary[] = [
      { moduleId: 'ige', state: 'PARTIAL', reasonCode: 'RATE_LIMITED', partial: true },
      { moduleId: 'ige', state: 'FAILED', reasonCode: 'PROVIDER_ERROR' },
      { moduleId: 'entity', state: 'BLOCKED', reasonCode: 'DEPENDENCY_FAILED' },
      { moduleId: 'serp', state: 'UNAVAILABLE', reasonCode: 'MISSING_CREDENTIAL' },
      { moduleId: 'redlab', state: 'SKIPPED', reasonCode: 'AUDIT_LAYER_TOO_LOW' },
      { moduleId: 'redlab', state: 'INELIGIBLE', reasonCode: 'PLAN_NOT_ELIGIBLE' },
    ];

    expect(summaries.map((summary) => summary.state)).toEqual([
      'PARTIAL', 'FAILED', 'BLOCKED', 'UNAVAILABLE', 'SKIPPED', 'INELIGIBLE',
    ]);
    expect(summaries.map(validateIntelligenceModuleExecutionSummary)).toEqual([[], [], [], [], [], []]);
  });

  it('validates only contradictory summaries, not a transition graph', () => {
    expect(validateIntelligenceModuleExecutionSummary({ moduleId: 'x', state: 'FAILED' }))
      .toContain('FAILED summaries should include a reason or reason code.');
    expect(validateIntelligenceModuleExecutionSummary({ moduleId: 'x', state: 'COMPLETED', reasonCode: 'EXECUTION_FAILED' }))
      .toContain('COMPLETED summaries cannot use a failure reason code.');
    expect(validateIntelligenceModuleExecutionSummary({ moduleId: 'x', state: 'FAILED', reasonCode: 'NO_EVIDENCE' }))
      .toContain('NO_EVIDENCE is valid only for completed or partial output.');
    expect(validateIntelligenceModuleExecutionSummary({ moduleId: 'x', state: 'PARTIAL', partial: false }))
      .toContain('PARTIAL summaries cannot explicitly set partial to false.');
  });

  it('expresses required and optional dependencies and capability requirements', () => {
    const dependencies: IntelligenceModuleDependency[] = [
      { moduleId: 'crawl', required: true, minimumState: 'COMPLETED' },
      { moduleId: 'search-console', required: false, minimumState: 'PARTIAL', description: 'Adds Google-authorized evidence when connected.' },
    ];
    const requirements: IntelligenceModuleRequirement[] = [
      { type: 'CREDENTIAL', key: 'SERPER_API_KEY', required: true },
      { type: 'PROVIDER', key: 'serp', required: true },
      { type: 'AUDIT_LAYER', key: 'layer-4', required: true },
      { type: 'MODULE', key: 'crawl', required: true },
    ];

    expect(dependencies[0].required).toBe(true);
    expect(dependencies[1].minimumState).toBe('PARTIAL');
    expect(requirements.every((requirement) => isIntelligenceModuleRequirementType(requirement.type))).toBe(true);
    expect(isIntelligenceModuleRequirementType('GRAPH')).toBe(false);
  });

  it('supports a minimal descriptor and an expanded descriptor without registration', () => {
    const minimal: IntelligenceModuleDescriptor = { id: 'scout', name: 'Scout', version: '1.0.0' };
    const expanded: IntelligenceModuleDescriptor = {
      ...minimal,
      id: 'redlab',
      name: 'RedLab',
      supportedAuditLayers: ['layer-4'],
      executionModes: ['WORKER'],
      dependencies: [{ moduleId: 'crawl', required: true, minimumState: 'COMPLETED' }],
      requirements: [{ type: 'PLAN', key: 'enterprise', required: true }],
    };

    expect(minimal.dependencies).toBeUndefined();
    expect(expanded.executionModes).toEqual(['WORKER']);
    expect(isIntelligenceExecutionMode('SERVERLESS')).toBe(true);
    expect(isIntelligenceExecutionMode('bullmq')).toBe(false);
  });

  it('represents provider availability without inspecting credentials', () => {
    const provider: ProviderAvailability = {
      provider: 'serp',
      available: false,
      configured: false,
      reasonCode: 'MISSING_CREDENTIAL',
    };
    expect(provider).toMatchObject({ provider: 'serp', available: false, reasonCode: 'MISSING_CREDENTIAL' });
  });
});
