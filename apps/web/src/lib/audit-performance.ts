/**
 * Audit runtime performance telemetry — measurement only, zero behavior change.
 *
 * A single reusable timing helper used to instrument runServerlessAudit() so one
 * controlled audit run can reveal where wall-clock time is actually spent, without
 * touching concurrency, retries, scoring, or persistence logic.
 *
 * Design constraints (see CLAUDE.md §"AUDIT RUNTIME TELEMETRY"):
 * - Recording a sample must never throw — every public method is wrapped so a
 *   telemetry bug can never fail the audit it's observing.
 * - measureStage() rethrows the original error unmodified so callers that already
 *   depend on try/catch or Promise.all fail-fast semantics see no behavior change.
 * - Only error *messages* (capped at 200 chars) are retained — never full page
 *   content, request/response bodies, or credentials.
 * - Parallel blocks should be measured as one wall-clock sample for the block
 *   plus one sample per child — never summed and presented as total elapsed time.
 */

import { logger } from '@/lib/logger';

export type StageOutcome = 'ok' | 'error';

interface StageBucket {
  totalMs: number;
  count: number;
  errorCount: number;
  lastError?: string;
}

export interface StageSummary {
  name: string;
  totalMs: number;
  count: number;
  avgMs: number;
  errorCount: number;
}

export interface AuditPerformanceRecorder {
  /** Wrap a single async operation; records duration + outcome, rethrows errors unmodified. */
  measureStage<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** Manual start/end for stages with multiple exit points (e.g. an early return mid-stage). */
  startStage(name: string): (outcome?: StageOutcome, errorMessage?: string) => void;
  /** Record a duration that was measured elsewhere (e.g. Date.now() deltas). */
  recordSample(name: string, durationMs: number, outcome?: StageOutcome, errorMessage?: string): void;
  setCounter(name: string, value: number): void;
  incrementCounter(name: string, delta?: number): void;
  getStages(): StageSummary[];
  getCounters(): Record<string, number>;
  /** Emit one structured log line summarizing the whole audit. Never throws. */
  emitSummary(auditId: string, domain: string, totalMs: number): void;
}

const MAX_ERROR_MESSAGE_CHARS = 200;

export function createAuditPerformanceRecorder(): AuditPerformanceRecorder {
  const stages = new Map<string, StageBucket>();
  const counters = new Map<string, number>();

  function recordSample(name: string, durationMs: number, outcome: StageOutcome = 'ok', errorMessage?: string): void {
    try {
      const bucket = stages.get(name) ?? { totalMs: 0, count: 0, errorCount: 0 };
      bucket.totalMs += durationMs;
      bucket.count += 1;
      if (outcome === 'error') {
        bucket.errorCount += 1;
        if (errorMessage) bucket.lastError = errorMessage.slice(0, MAX_ERROR_MESSAGE_CHARS);
      }
      stages.set(name, bucket);
    } catch {
      // Recording a sample must never affect the audit it's observing.
    }
  }

  function startStage(name: string): (outcome?: StageOutcome, errorMessage?: string) => void {
    const start = Date.now();
    let ended = false;
    return (outcome: StageOutcome = 'ok', errorMessage?: string) => {
      if (ended) return; // idempotent — a stage can only be recorded once
      ended = true;
      recordSample(name, Date.now() - start, outcome, errorMessage);
    };
  }

  async function measureStage<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const end = startStage(name);
    try {
      const result = await fn();
      end('ok');
      return result;
    } catch (err) {
      end('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  function setCounter(name: string, value: number): void {
    try { counters.set(name, value); } catch { /* never throw */ }
  }

  function incrementCounter(name: string, delta = 1): void {
    try { counters.set(name, (counters.get(name) ?? 0) + delta); } catch { /* never throw */ }
  }

  function getStages(): StageSummary[] {
    return [...stages.entries()].map(([name, b]) => ({
      name,
      totalMs: b.totalMs,
      count: b.count,
      avgMs: b.count > 0 ? Math.round(b.totalMs / b.count) : 0,
      errorCount: b.errorCount,
    }));
  }

  function getCounters(): Record<string, number> {
    return Object.fromEntries(counters.entries());
  }

  function emitSummary(auditId: string, domain: string, totalMs: number): void {
    try {
      const stageList = getStages().sort((a, b) => b.totalMs - a.totalMs);
      const line = stageList
        .map((s) => `${s.name}=${s.totalMs}ms(x${s.count}${s.errorCount ? `,${s.errorCount}err` : ''})`)
        .join(' ');
      logger.info(
        { auditId, domain, totalMs, stages: stageList, counters: getCounters() },
        `Audit Performance | ${line} | TOTAL=${totalMs}ms`,
      );
    } catch {
      // Emitting the summary must never fail the audit.
    }
  }

  return {
    measureStage,
    startStage,
    recordSample,
    setCounter,
    incrementCounter,
    getStages,
    getCounters,
    emitSummary,
  };
}
