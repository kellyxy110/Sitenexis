import { describe, it, expect } from 'vitest';
import { buildCompactAuditSummary, summaryToPromptBlock, type AuditSummaryInput } from '../summary';

const base: AuditSummaryInput = {
  domain: 'example.com',
  status: 'complete',
  pageCount: 12,
  scores: { overall: 72, seoScore: 80, aiScore: 64 },
  aiVisibilityScores: {
    aiVisibilityScore: 64,
    entityConfidenceScore: 70,
    citationProbabilityScore: 55,
    machineReadabilityScore: 82,
    semanticTrustScore: 60,
  },
  issues: [
    { module: 'seo', type: 'thin_content', severity: 'warning', message: 'Thin content', recommendation: 'Add words' },
    { module: 'ai', type: 'missing_entity', severity: 'critical', message: 'No primary entity', recommendation: 'Define it' },
    { module: 'seo', type: 'meta', severity: 'info', message: 'Meta note', recommendation: null },
  ],
  entities: [{ name: 'Example Inc', type: 'Organization' }, { name: 'X', type: 'Person' }],
};

describe('buildCompactAuditSummary', () => {
  it('carries scores and orders issues by severity (critical first)', () => {
    const s = buildCompactAuditSummary(base);
    expect(s.domain).toBe('example.com');
    expect(s.scores.overall).toBe(72);
    expect(s.scores.aiVisibility).toBe(64);
    expect(s.topIssues[0]?.severity).toBe('critical'); // sorted ahead of warning/info
    expect(s.issueCounts).toEqual({ critical: 1, warning: 1, info: 1 });
  });

  it('caps issues (≤12) and entities (≤8) so the prompt cannot bloat', () => {
    const many: AuditSummaryInput = {
      ...base,
      issues: Array.from({ length: 40 }, (_, i) => ({ module: 'seo', type: `t${i}`, severity: 'warning', message: 'm', recommendation: 'r' })),
      entities: Array.from({ length: 30 }, (_, i) => ({ name: `E${i}`, type: 'Thing' })),
    };
    const s = buildCompactAuditSummary(many);
    expect(s.topIssues.length).toBe(12);
    expect(s.primaryEntities.length).toBe(8);
  });

  it('truncates long messages/recommendations', () => {
    const long = 'x'.repeat(1000);
    const s = buildCompactAuditSummary({ ...base, issues: [{ module: 'seo', type: 't', severity: 'critical', message: long, recommendation: long }] });
    expect(s.topIssues[0]?.message.length).toBeLessThanOrEqual(240);
    expect((s.topIssues[0]?.recommendation ?? '').length).toBeLessThanOrEqual(240);
  });

  it('handles null scores / entities without throwing', () => {
    const s = buildCompactAuditSummary({ ...base, scores: null, aiVisibilityScores: null, entities: null });
    expect(s.scores).toEqual({});
    expect(s.primaryEntities).toEqual([]);
  });

  it('serializes to valid JSON', () => {
    const s = buildCompactAuditSummary(base);
    expect(() => JSON.parse(summaryToPromptBlock(s))).not.toThrow();
  });
});
