/**
 * Bridges the raw SSE stream payload (apps/web/src/app/api/audit/[id]/stream)
 * into the canonical AuditProgressInput the pure engine consumes. Kept
 * separate from computeAuditProgress so the SSE wire shape can evolve (or a
 * BullMQ-worker-sourced payload can be added later) without touching the
 * calculation itself.
 */

import type { AuditAgentManifest } from '@sitenexis/shared';
import type { AuditProgressInput, ExecutionMode } from './types';

export interface RawProgressSignal {
  status?: string | undefined;
  agentManifest?: AuditAgentManifest | undefined;
  pagesCount?: number | undefined;
  error?: string | undefined;
}

export interface BuildProgressInputParams {
  auditId: string;
  domain: string;
  executionMode: ExecutionMode;
  signal: RawProgressSignal;
  startedAtMs: number;
  nowMs: number;
}

const KNOWN_STATUSES = new Set(['queued', 'running', 'partial', 'complete', 'failed']);

export function buildProgressInput({
  auditId, domain: _domain, executionMode, signal, startedAtMs, nowMs,
}: BuildProgressInputParams): AuditProgressInput {
  const auditStatus = KNOWN_STATUSES.has(signal.status ?? '') ? (signal.status as AuditProgressInput['auditStatus']) : 'running';
  const isFinished = auditStatus === 'complete' || auditStatus === 'partial' || auditStatus === 'failed';

  return {
    auditId,
    domain: _domain,
    executionMode,
    auditStatus,
    agentManifest: signal.agentManifest ?? null,
    // The serverless runner reports a real, live-incrementing pageCount during
    // crawl (see serverless-audit.ts onCrawlProgress) — 0 is a genuine "not
    // started yet" value there, so it's passed through as-is, not nulled out.
    pagesDiscovered: signal.pagesCount ?? null,
    pagesFetched: signal.pagesCount ?? null,
    pagesRendered: null,
    pagesFailed: null,
    startedAtMs,
    nowMs,
    completedAtMs: isFinished ? nowMs : null,
    errorMessage: signal.error ?? null,
  };
}
