import { describe, it, expect } from 'vitest';
import { computeAuditProgress } from '../compute-progress';
import { derivePhaseTimeline } from '../phase-timeline';
import type { AuditProgressInput } from '../types';
import type { AuditAgentManifest, AuditAgentState, AgentResultStatus } from '@sitenexis/shared';
import { DEFAULT_AUDIT_AGENTS } from '@sitenexis/shared';

function agentState(agent: string, status: AgentResultStatus): AuditAgentState {
  return { agent, status, startedAt: null, finishedAt: null, durationMs: null, retryCount: 0, keyOutput: null, resultPersisted: status !== 'failed' };
}

function manifest(overrides: Record<string, AgentResultStatus>): AuditAgentManifest {
  const agents: Record<string, AuditAgentState> = {};
  const allKeys = new Set([...DEFAULT_AUDIT_AGENTS, 'ai-governance', ...Object.keys(overrides)]);
  for (const a of allKeys) agents[a] = agentState(a, overrides[a] ?? 'pending');
  return { version: 1, required: [...DEFAULT_AUDIT_AGENTS], agents, updatedAt: '2026-01-01T00:00:00.000Z' };
}

function baseInput(overrides: Partial<AuditProgressInput> = {}): AuditProgressInput {
  return {
    auditId: 'audit-1', domain: 'example.com', executionMode: 'serverless', auditStatus: 'running',
    agentManifest: manifest({}), pagesDiscovered: null, pagesFetched: null, pagesRendered: null,
    pagesFailed: null, startedAtMs: 0, nowMs: 20_000, completedAtMs: null, errorMessage: null,
    ...overrides,
  };
}

describe('derivePhaseTimeline', () => {
  it('marks every phase WAITING before anything has started', () => {
    const state = computeAuditProgress(baseInput({ nowMs: 500 }));
    const timeline = derivePhaseTimeline(state);
    expect(timeline.every((p) => p.status === 'WAITING')).toBe(true);
  });

  it('marks the crawl phase COMPLETE and moves on once the crawl agent finishes', () => {
    const state = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'completed' }) }));
    const timeline = derivePhaseTimeline(state);
    expect(timeline.find((p) => p.id === 'CRAWLING')?.status).toBe('COMPLETE');
    expect(timeline.find((p) => p.id === 'ANALYSING_SEO')?.status).toBe('WAITING');
  });

  it('marks a phase ACTIVE when some but not all of its agents have started', () => {
    const state = computeAuditProgress(baseInput({
      agentManifest: manifest({ crawl: 'completed', seo: 'running' }),
    }));
    expect(derivePhaseTimeline(state).find((p) => p.id === 'ANALYSING_SEO')?.status).toBe('ACTIVE');
  });

  it('exposes the real per-agent breakdown for a multi-agent phase, showing them as visibly parallel', () => {
    const state = computeAuditProgress(baseInput({
      agentManifest: manifest({
        crawl: 'completed', seo: 'completed', schema: 'completed',
        entity: 'completed', retrieval: 'running', scout: 'running',
      }),
    }));
    const aiPhase = derivePhaseTimeline(state).find((p) => p.id === 'ANALYSING_AI_VISIBILITY')!;
    expect(aiPhase.status).toBe('ACTIVE');
    expect(aiPhase.modules.length).toBeGreaterThan(1);
    const byId = Object.fromEntries(aiPhase.modules.map((m) => [m.id, m.state]));
    expect(byId['entity']).toBe('COMPLETE');
    expect(byId['retrieval']).toBe('ACTIVE');
    expect(byId['scout']).toBe('ACTIVE');
  });

  it('does not expose a modules breakdown for a single-agent phase (nothing concurrent to show)', () => {
    const state = computeAuditProgress(baseInput({ agentManifest: manifest({ crawl: 'running' }) }));
    expect(derivePhaseTimeline(state).find((p) => p.id === 'CRAWLING')?.modules).toEqual([]);
  });

  it('marks a phase FAILED when any of its agents failed, even if others in the same phase completed', () => {
    const failing = manifest({ crawl: 'completed', seo: 'completed', schema: 'completed' });
    failing.agents['machine-trust'] = agentState('machine-trust', 'failed');
    failing.agents['retrieval-simulation'] = agentState('retrieval-simulation', 'completed');
    failing.agents['temporal-authority'] = agentState('temporal-authority', 'completed');
    failing.agents['recommendation-mapping'] = agentState('recommendation-mapping', 'completed');
    failing.agents['synthetic-entity'] = agentState('synthetic-entity', 'completed');
    const state = computeAuditProgress(baseInput({ agentManifest: failing }));
    expect(derivePhaseTimeline(state).find((p) => p.id === 'ANALYSING_MACHINE_TRUST')?.status).toBe('FAILED');
  });

  it('marks a phase PARTIAL (not a clean COMPLETE) when an agent in it reports partial', () => {
    const partial = manifest({ crawl: 'completed', seo: 'completed', schema: 'completed' });
    partial.agents['machine-trust'] = agentState('machine-trust', 'partial');
    partial.agents['retrieval-simulation'] = agentState('retrieval-simulation', 'completed');
    partial.agents['temporal-authority'] = agentState('temporal-authority', 'completed');
    partial.agents['recommendation-mapping'] = agentState('recommendation-mapping', 'completed');
    partial.agents['synthetic-entity'] = agentState('synthetic-entity', 'completed');
    const state = computeAuditProgress(baseInput({ agentManifest: partial }));
    expect(derivePhaseTimeline(state).find((p) => p.id === 'ANALYSING_MACHINE_TRUST')?.status).toBe('PARTIAL');
  });

  it('every phase list has a stable, non-empty label for display', () => {
    const state = computeAuditProgress(baseInput());
    for (const phase of derivePhaseTimeline(state)) {
      expect(phase.label.length).toBeGreaterThan(0);
    }
  });
});
