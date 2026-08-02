/**
 * Derives a deduplicated, human-readable live event feed purely from
 * successive AuditProgressState snapshots — never from raw page content, and
 * never inventing an event ("robots.txt checked", etc.) that isn't backed by
 * real signal in the current agentManifest/page-count telemetry.
 */

import type { AuditProgressState, ModuleStatus } from './types';

export interface LifecycleEvent {
  /** Stable key for React lists and for de-duplicating across snapshots. */
  id: string;
  message: string;
  kind: 'success' | 'active' | 'warning' | 'info';
  atMs: number;
}

const PAGE_MILESTONE_INTERVAL = 10;

function moduleKey(m: ModuleStatus): string {
  return m.id;
}

export function deriveLifecycleEvents(
  previous: AuditProgressState | null,
  next: AuditProgressState,
  nowMs: number,
): LifecycleEvent[] {
  const events: LifecycleEvent[] = [];

  // ── Stage transition ───────────────────────────────────────────────────
  if (!previous || previous.stage !== next.stage) {
    events.push({
      id: `stage:${next.stage}`,
      message: next.currentActivity,
      kind: 'active',
      atMs: nowMs,
    });
  }

  // ── Module completions / failures (fire once, on the transition) ──────
  const prevCompletedIds = new Set((previous?.completedModules ?? []).map(moduleKey));
  const prevUnavailableIds = new Set((previous?.unavailableModules ?? []).map(moduleKey));

  for (const mod of next.completedModules) {
    if (prevCompletedIds.has(moduleKey(mod))) continue;
    const isFailure = mod.state === 'FAILED';
    const isPartial = mod.state === 'PARTIAL';
    events.push({
      id: `module:${mod.id}:${mod.state}`,
      message: isFailure
        ? `${mod.label} failed${mod.detail ? ` — ${mod.detail}` : ''}`
        : isPartial
          ? `${mod.label} completed with limited results${mod.detail ? ` — ${mod.detail}` : ''}`
          : `${mod.label} complete${mod.detail ? ` — ${mod.detail}` : ''}`,
      kind: isFailure ? 'warning' : isPartial ? 'warning' : 'success',
      atMs: nowMs,
    });
  }

  for (const mod of next.unavailableModules) {
    if (prevUnavailableIds.has(moduleKey(mod))) continue;
    events.push({
      id: `module:${mod.id}:unavailable`,
      message: `${mod.label} unavailable${mod.detail ? ` — ${mod.detail}` : ''}`,
      kind: 'info',
      atMs: nowMs,
    });
  }

  // ── Page-count milestones — deduplicated so a 500-page audit doesn't flood ──
  const prevPages = previous?.pagesFetched ?? 0;
  const nextPages = next.pagesFetched ?? 0;
  const prevMilestone = Math.floor(prevPages / PAGE_MILESTONE_INTERVAL);
  const nextMilestone = Math.floor(nextPages / PAGE_MILESTONE_INTERVAL);
  if (nextMilestone > prevMilestone && nextPages > 0) {
    events.push({
      id: `pages:${nextMilestone}`,
      message: `${nextPages} pages fetched so far`,
      kind: 'info',
      atMs: nowMs,
    });
  }

  // ── Completion / failure terminal events ──────────────────────────────
  if (next.stage === 'COMPLETED' && previous?.stage !== 'COMPLETED') {
    events.push({ id: 'terminal:complete', message: 'Audit complete.', kind: 'success', atMs: nowMs });
  }
  if (next.stage === 'PARTIAL' && previous?.stage !== 'PARTIAL') {
    events.push({ id: 'terminal:partial', message: 'Audit completed with partial results.', kind: 'warning', atMs: nowMs });
  }
  if (next.stage === 'FAILED' && previous?.stage !== 'FAILED') {
    events.push({ id: 'terminal:failed', message: next.errorMessage ?? 'Audit failed.', kind: 'warning', atMs: nowMs });
  }

  return events;
}

/**
 * Merges newly derived events into a running feed, keeping it bounded and
 * deduplicated by id (a stage can re-fire its own id if state legitimately
 * regresses is not possible here, but defensive dedup costs nothing).
 */
export function appendLifecycleEvents(
  feed: LifecycleEvent[],
  newEvents: LifecycleEvent[],
  maxLength = 40,
): LifecycleEvent[] {
  if (newEvents.length === 0) return feed;
  const seen = new Set(feed.map((e) => e.id));
  const toAdd = newEvents.filter((e) => !seen.has(e.id));
  if (toAdd.length === 0) return feed;
  const merged = [...feed, ...toAdd];
  return merged.length > maxLength ? merged.slice(merged.length - maxLength) : merged;
}
