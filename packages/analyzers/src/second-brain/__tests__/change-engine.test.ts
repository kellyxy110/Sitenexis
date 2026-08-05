import { describe, it, expect } from 'vitest';
import { computeAuditChanges } from '../change-engine';
import type { AuditScoreSnapshot } from '../types';

function snapshot(auditId: string, overrides: Partial<Omit<AuditScoreSnapshot, 'auditId'>> = {}): AuditScoreSnapshot {
  return {
    auditId,
    overall: 70,
    seoScore: 70,
    aiVisibilityScore: 70,
    entityConfidenceScore: 70,
    retrievalReadinessScore: 70,
    citationProbabilityScore: 70,
    semanticTrustScore: 70,
    machineTrustScore: 70,
    ...overrides,
  };
}

describe('computeAuditChanges', () => {
  it('classifies an increase as IMPROVED', () => {
    const prev = snapshot('a1', { aiVisibilityScore: 60 });
    const curr = snapshot('a2', { aiVisibilityScore: 75 });
    const changes = computeAuditChanges(prev, curr);
    const aiVisibility = changes.find((c) => c.metricKey === 'aiVisibilityScore');
    expect(aiVisibility).toEqual({ metricKey: 'aiVisibilityScore', previousValue: 60, currentValue: 75, classification: 'IMPROVED' });
  });

  it('classifies a decrease as REGRESSED', () => {
    const prev = snapshot('a1', { seoScore: 80 });
    const curr = snapshot('a2', { seoScore: 65 });
    const changes = computeAuditChanges(prev, curr);
    const seo = changes.find((c) => c.metricKey === 'seoScore');
    expect(seo?.classification).toBe('REGRESSED');
  });

  it('classifies an identical value as UNCHANGED', () => {
    const prev = snapshot('a1', { machineTrustScore: 42 });
    const curr = snapshot('a2', { machineTrustScore: 42 });
    const changes = computeAuditChanges(prev, curr);
    const mt = changes.find((c) => c.metricKey === 'machineTrustScore');
    expect(mt?.classification).toBe('UNCHANGED');
  });

  it('classifies unavailable → available as INTRODUCED, never coercing null to 0', () => {
    const prev = snapshot('a1', { citationProbabilityScore: null });
    const curr = snapshot('a2', { citationProbabilityScore: 55 });
    const changes = computeAuditChanges(prev, curr);
    const cp = changes.find((c) => c.metricKey === 'citationProbabilityScore');
    expect(cp).toEqual({ metricKey: 'citationProbabilityScore', previousValue: null, currentValue: 55, classification: 'INTRODUCED' });
  });

  it('emits no row for available → unavailable — never fabricates REGRESSED from missing data', () => {
    const prev = snapshot('a1', { entityConfidenceScore: 88 });
    const curr = snapshot('a2', { entityConfidenceScore: null });
    const changes = computeAuditChanges(prev, curr);
    expect(changes.find((c) => c.metricKey === 'entityConfidenceScore')).toBeUndefined();
  });

  it('emits no row when both audits lack the metric', () => {
    const prev = snapshot('a1', { retrievalReadinessScore: null });
    const curr = snapshot('a2', { retrievalReadinessScore: null });
    const changes = computeAuditChanges(prev, curr);
    expect(changes.find((c) => c.metricKey === 'retrievalReadinessScore')).toBeUndefined();
  });

  it('never treats a null value as numerically less than a real value (no implicit 0-coercion)', () => {
    // If null were coerced to 0 anywhere internally, this would produce
    // classification REGRESSED (0 < 70) instead of the correct INTRODUCED.
    const prev = snapshot('a1', { overall: null });
    const curr = snapshot('a2', { overall: 1 });
    const changes = computeAuditChanges(prev, curr);
    expect(changes.find((c) => c.metricKey === 'overall')?.classification).toBe('INTRODUCED');
  });

  it('sources machineTrustScore only from the value the caller supplies for it — proves the engine has no hardcoded fallback to a different field', () => {
    const prev = snapshot('a1', { machineTrustScore: 30 });
    const curr = snapshot('a2', { machineTrustScore: 90, semanticTrustScore: 10 });
    const changes = computeAuditChanges(prev, curr);
    expect(changes.find((c) => c.metricKey === 'machineTrustScore')).toEqual({
      metricKey: 'machineTrustScore', previousValue: 30, currentValue: 90, classification: 'IMPROVED',
    });
    // semanticTrustScore compared independently — proves the two are never conflated inside the engine.
    const semantic = changes.find((c) => c.metricKey === 'semanticTrustScore');
    expect(semantic?.classification).toBe('REGRESSED');
  });

  it('covers all eight canonical metrics when every value is available and different', () => {
    const prev = snapshot('a1');
    const curr = snapshot('a2', {
      overall: 71, seoScore: 71, aiVisibilityScore: 71, entityConfidenceScore: 71,
      retrievalReadinessScore: 71, citationProbabilityScore: 71, semanticTrustScore: 71, machineTrustScore: 71,
    });
    const changes = computeAuditChanges(prev, curr);
    expect(changes).toHaveLength(8);
    expect(changes.every((c) => c.classification === 'IMPROVED')).toBe(true);
  });
});
