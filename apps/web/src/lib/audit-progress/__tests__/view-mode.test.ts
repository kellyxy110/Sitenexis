import { describe, it, expect } from 'vitest';
import { deriveViewMode } from '../view-mode';
import type { AuditProgressState } from '../types';

function state(stage: AuditProgressState['stage']): AuditProgressState {
  return {
    auditId: 'a1', executionMode: 'serverless', stage, currentActivity: '', currentUrl: null,
    pagesDiscovered: null, pagesFetched: null, pagesRendered: null, pagesAnalysed: null, pagesFailed: null,
    activeModules: [], completedModules: [], unavailableModules: [],
    elapsedMs: 0, estimatedRemainingLabel: '', progress: 0, errorMessage: null, limitations: [],
  };
}

describe('deriveViewMode', () => {
  it('maps FAILED to the failed view', () => {
    expect(deriveViewMode(state('FAILED'))).toBe('failed');
  });

  it('maps PARTIAL to the partial view, not the plain completed view', () => {
    expect(deriveViewMode(state('PARTIAL'))).toBe('partial');
  });

  it('maps COMPLETED to the completed view', () => {
    expect(deriveViewMode(state('COMPLETED'))).toBe('completed');
  });

  it('maps every in-progress stage to the running view', () => {
    const inProgressStages: AuditProgressState['stage'][] = [
      'CRAWLING', 'ANALYSING_SEO', 'ANALYSING_AI_VISIBILITY', 'ANALYSING_MACHINE_TRUST',
      'GENERATING_REPORT', 'RUNNING_SCOUT', 'ANALYSING_GOVERNANCE', 'BUILDING_INTELLIGENCE',
    ];
    for (const stage of inProgressStages) {
      expect(deriveViewMode(state(stage))).toBe('running');
    }
  });
});
