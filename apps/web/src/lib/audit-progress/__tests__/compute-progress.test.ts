import { describe, it, expect } from 'vitest';
import { computeAuditProgress } from '../compute-progress';
import type { AuditProgressInput } from '../types';
import type { AuditAgentManifest, AuditAgentState, AgentResultStatus } from '@sitenexis/shared';
import { DEFAULT_AUDIT_AGENTS } from '@sitenexis/shared';

function agentState(agent: string, status: AgentResultStatus, keyOutput: string | null = null): AuditAgentState {
  return {
    agent, status, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: null,
    durationMs: null, retryCount: 0, keyOutput, resultPersisted: status !== 'failed',
  };
}

function manifest(overrides: Record<string, AgentResultStatus>): AuditAgentManifest {
  const agents: Record<string, AuditAgentState> = {};
  // 'ai-governance' is written by markAgent() in serverless-audit.ts but is not
  // part of DEFAULT_AUDIT_AGENTS — include both so overrides for either work.
  const allKeys = new Set([...DEFAULT_AUDIT_AGENTS, 'ai-governance', ...Object.keys(overrides)]);
  for (const a of allKeys) agents[a] = agentState(a, overrides[a] ?? 'pending');
  return { version: 1, required: [...DEFAULT_AUDIT_AGENTS], agents, updatedAt: '2026-01-01T00:00:00.000Z' };
}

function baseInput(overrides: Partial<AuditProgressInput> = {}): AuditProgressInput {
  return {
    auditId: 'audit-1',
    domain: 'example.com',
    executionMode: 'serverless',
    auditStatus: 'running',
    agentManifest: manifest({}),
    pagesDiscovered: null,
    pagesFetched: null,
    pagesRendered: null,
    pagesFailed: null,
    startedAtMs: 0,
    nowMs: 10_000,
    completedAtMs: null,
    errorMessage: null,
    ...overrides,
  };
}

describe('computeAuditProgress — weighted stage calculation', () => {
  it('reports 0 progress and the crawl stage when nothing has started', () => {
    const result = computeAuditProgress(baseInput({ nowMs: 500 }));
    expect(result.stage).toBe('CRAWLING');
    expect(result.progress).toBe(0);
  });

  it('increases progress once the crawl agent is running (a visible floor, not 0)', () => {
    const result = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'running' }) }));
    expect(result.progress).toBeGreaterThan(0);
    expect(result.progress).toBeLessThan(100);
  });

  it('awards the full crawl-phase weight once crawl completes, moving to the next phase', () => {
    const result = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'completed' }) }));
    expect(result.progress).toBeGreaterThanOrEqual(35); // crawl phase weight
    expect(result.stage).toBe('ANALYSING_SEO');
  });

  it('never reaches 100 while the audit is still running, regardless of how many agents complete', () => {
    const allDone = Object.fromEntries(DEFAULT_AUDIT_AGENTS.map((a) => [a, 'completed' as const]));
    const result = computeAuditProgress(baseInput({ agentManifest: manifest(allDone), auditStatus: 'running' }));
    expect(result.progress).toBeLessThanOrEqual(99);
  });

  it('reaches exactly 100 only when the audit status itself is complete', () => {
    const result = computeAuditProgress(baseInput({ auditStatus: 'complete', completedAtMs: 20_000 }));
    expect(result.progress).toBe(100);
    expect(result.stage).toBe('COMPLETED');
  });

  it('is monotonic — progress computed from a strictly later manifest state is never lower', () => {
    const early = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'running' }) }));
    const later = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'completed', seo: 'running' }) }));
    const latest = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'completed', seo: 'completed', schema: 'completed' }) }));
    expect(later.progress).toBeGreaterThanOrEqual(early.progress);
    expect(latest.progress).toBeGreaterThanOrEqual(later.progress);
  });

  it('uses real page counts (capped at the real MAX_PAGES constant) rather than fabricating a number', () => {
    const result = computeAuditProgress(baseInput({ pagesFetched: 12 }));
    expect(result.pagesFetched).toBe(12);
  });

  it('reports pagesFetched as null (not 0) when the execution path does not supply live counts', () => {
    const result = computeAuditProgress(baseInput({ pagesFetched: null }));
    expect(result.pagesFetched).toBeNull();
    expect(result.limitations.some((l) => l.includes('Live page counts'))).toBe(true);
  });

  it('treats entity/retrieval/citation/semantic-trust/scout/governance as concurrent modules, not a sequential percentage', () => {
    const result = computeAuditProgress(baseInput({
      agentManifest: manifest({
        crawl: 'completed', seo: 'completed', schema: 'completed',
        entity: 'completed', retrieval: 'running', scout: 'running', 'ai-governance': 'completed',
      }),
    }));
    expect(result.stage).toBe('ANALYSING_AI_VISIBILITY');
    const activeIds = result.activeModules.map((m) => m.id).sort();
    expect(activeIds).toEqual(['retrieval', 'scout']);
    const completedIds = result.completedModules.map((m) => m.id);
    expect(completedIds).toContain('entity');
    expect(completedIds).toContain('ai-governance');
  });

  it('classifies a not_configured/no_data agent as unavailable, not failed or waiting', () => {
    const result = computeAuditProgress(baseInput({
      agentManifest: manifest({ crawl: 'completed', seo: 'completed', schema: 'completed', 'information-gain': 'no_data' }),
    }));
    const infoGain = result.unavailableModules.find((m) => m.id === 'information-gain');
    expect(infoGain).toBeDefined();
    expect(result.completedModules.find((m) => m.id === 'information-gain')).toBeUndefined();
  });

  it('classifies a partial agent as completed-with-caveats, distinct from a clean completion', () => {
    const result = computeAuditProgress(baseInput({
      agentManifest: manifest({ crawl: 'completed', 'machine-trust': 'partial' }),
    }));
    const mt = result.completedModules.find((m) => m.id === 'machine-trust');
    expect(mt?.state).toBe('PARTIAL');
  });

  it('classifies a failed agent distinctly and surfaces its failureReason as detail', () => {
    const failing = manifest({ crawl: 'completed' });
    failing.agents['machine-trust'] = { ...agentState('machine-trust', 'failed'), failureReason: 'Layer 4 write failed' };
    const result = computeAuditProgress(baseInput({ agentManifest: failing }));
    const mt = result.completedModules.find((m) => m.id === 'machine-trust');
    expect(mt?.state).toBe('FAILED');
    expect(mt?.detail).toBe('Layer 4 write failed');
  });

  it('reports the FAILED stage with the real error message when the audit itself failed', () => {
    const result = computeAuditProgress(baseInput({ auditStatus: 'failed', errorMessage: 'Homepage returned 403' }));
    expect(result.stage).toBe('FAILED');
    expect(result.errorMessage).toBe('Homepage returned 403');
    expect(result.progress).toBe(0);
  });

  it('shows "Estimating..." (not a fabricated countdown) before enough signal exists', () => {
    const result = computeAuditProgress(baseInput({ nowMs: 2_000, agentManifest: manifest({ crawl: 'running' }) }));
    expect(result.estimatedRemainingLabel).toBe('Estimating...');
  });

  it('derives a conservative ETA once enough elapsed time and progress exist', () => {
    const result = computeAuditProgress(baseInput({
      nowMs: 30_000,
      agentManifest: manifest({ crawl: 'completed', seo: 'completed', schema: 'completed' }),
    }));
    expect(result.estimatedRemainingLabel).not.toBe('Estimating...');
    expect(result.estimatedRemainingLabel).toMatch(/remaining/);
  });

  it('reports an empty ETA label once the audit is finished', () => {
    const result = computeAuditProgress(baseInput({ auditStatus: 'complete', completedAtMs: 20_000 }));
    expect(result.estimatedRemainingLabel).toBe('');
  });

  it('flags partial completion distinctly from a clean complete', () => {
    const result = computeAuditProgress(baseInput({ auditStatus: 'partial', completedAtMs: 20_000 }));
    expect(result.stage).toBe('PARTIAL');
    expect(result.progress).toBe(100);
    expect(result.currentActivity).toMatch(/partial/i);
  });
});
