import { describe, it, expect } from 'vitest';
import { deriveLifecycleEvents, appendLifecycleEvents } from '../lifecycle-events';
import type { AuditProgressState, ModuleStatus } from '../types';

function mod(id: string, state: ModuleStatus['state'], detail: string | null = null): ModuleStatus {
  return { id, label: id, state, detail };
}

function state(overrides: Partial<AuditProgressState> = {}): AuditProgressState {
  return {
    auditId: 'audit-1',
    executionMode: 'serverless',
    stage: 'CRAWLING',
    currentActivity: 'Crawling',
    currentUrl: null,
    pagesDiscovered: null,
    pagesFetched: 0,
    pagesRendered: null,
    pagesAnalysed: null,
    pagesFailed: null,
    activeModules: [],
    completedModules: [],
    unavailableModules: [],
    elapsedMs: 0,
    estimatedRemainingLabel: 'Estimating...',
    progress: 0,
    errorMessage: null,
    limitations: [],
    ...overrides,
  };
}

describe('deriveLifecycleEvents', () => {
  it('emits a stage-transition event on the very first snapshot (previous is null)', () => {
    const events = deriveLifecycleEvents(null, state({ stage: 'CRAWLING', currentActivity: 'Crawling site' }), 1000);
    expect(events.some((e) => e.message === 'Crawling site')).toBe(true);
  });

  it('emits nothing extra when the stage is unchanged and nothing else moved', () => {
    const prev = state({ stage: 'CRAWLING' });
    const next = state({ stage: 'CRAWLING' });
    const events = deriveLifecycleEvents(prev, next, 2000);
    expect(events).toHaveLength(0);
  });

  it('emits exactly one completion event per module the first time it appears complete', () => {
    const prev = state({ completedModules: [] });
    const next = state({ completedModules: [mod('seo', 'COMPLETE', '3 findings')] });
    const events = deriveLifecycleEvents(prev, next, 3000);
    expect(events.filter((e) => e.id.startsWith('module:seo'))).toHaveLength(1);
    expect(events.find((e) => e.id.startsWith('module:seo'))?.message).toContain('3 findings');
  });

  it('does not re-emit a module completion event on a later snapshot where it is still complete', () => {
    const withSeo = state({ completedModules: [mod('seo', 'COMPLETE')] });
    const events = deriveLifecycleEvents(withSeo, withSeo, 4000);
    expect(events.filter((e) => e.id.startsWith('module:seo'))).toHaveLength(0);
  });

  it('labels a failed module as a warning, distinct from a clean completion', () => {
    const prev = state({ completedModules: [] });
    const next = state({ completedModules: [mod('machine-trust', 'FAILED', 'DB write failed')] });
    const events = deriveLifecycleEvents(prev, next, 5000);
    const ev = events.find((e) => e.id.includes('machine-trust'));
    expect(ev?.kind).toBe('warning');
    expect(ev?.message).toContain('failed');
  });

  it('emits an unavailable-module event once, not repeatedly', () => {
    const prev = state({ unavailableModules: [] });
    const withUnavailable = state({ unavailableModules: [mod('information-gain', 'UNAVAILABLE', 'Requires SERPER_API_KEY')] });
    const first = deriveLifecycleEvents(prev, withUnavailable, 6000);
    const second = deriveLifecycleEvents(withUnavailable, withUnavailable, 7000);
    expect(first.filter((e) => e.id.includes('information-gain'))).toHaveLength(1);
    expect(second.filter((e) => e.id.includes('information-gain'))).toHaveLength(0);
  });

  it('deduplicates page-count events to milestone boundaries, not every single page', () => {
    const prev = state({ pagesFetched: 8 });
    const barelyMoved = state({ pagesFetched: 9 }); // still inside the same 10-page bucket
    const crossedBoundary = state({ pagesFetched: 11 }); // crosses the 10-page boundary

    expect(deriveLifecycleEvents(prev, barelyMoved, 8000).filter((e) => e.id.startsWith('pages:'))).toHaveLength(0);
    expect(deriveLifecycleEvents(prev, crossedBoundary, 9000).filter((e) => e.id.startsWith('pages:'))).toHaveLength(1);
  });

  it('emits exactly one terminal completion event when transitioning into COMPLETED', () => {
    const prev = state({ stage: 'GENERATING_REPORT' });
    const next = state({ stage: 'COMPLETED', progress: 100 });
    const events = deriveLifecycleEvents(prev, next, 10_000);
    expect(events.filter((e) => e.id === 'terminal:complete')).toHaveLength(1);
  });

  it('emits the real error message on transitioning into FAILED, never a generic placeholder when one is available', () => {
    const prev = state({ stage: 'CRAWLING' });
    const next = state({ stage: 'FAILED', errorMessage: 'Homepage returned 403 — blocked by Akamai' });
    const events = deriveLifecycleEvents(prev, next, 11_000);
    const failEvent = events.find((e) => e.id === 'terminal:failed');
    expect(failEvent?.message).toBe('Homepage returned 403 — blocked by Akamai');
  });
});

describe('appendLifecycleEvents', () => {
  it('appends new events and drops exact-id duplicates', () => {
    const feed = [{ id: 'a', message: 'A', kind: 'info' as const, atMs: 1 }];
    const merged = appendLifecycleEvents(feed, [
      { id: 'a', message: 'A again', kind: 'info', atMs: 2 },
      { id: 'b', message: 'B', kind: 'info', atMs: 2 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.id === 'a')?.message).toBe('A'); // original kept, not overwritten
  });

  it('bounds the feed length so a long-running audit does not accumulate unbounded state', () => {
    const feed = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, message: `${i}`, kind: 'info' as const, atMs: i }));
    const merged = appendLifecycleEvents(feed, [{ id: 'new', message: 'new', kind: 'info', atMs: 41 }], 40);
    expect(merged).toHaveLength(40);
    expect(merged[merged.length - 1]!.id).toBe('new');
    expect(merged.find((e) => e.id === 'e0')).toBeUndefined(); // oldest dropped
  });
});
