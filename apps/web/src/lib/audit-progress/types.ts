/**
 * Canonical progress contract for the live audit experience.
 *
 * This is the ONE typed shape both the serverless and (future) BullMQ worker
 * execution paths should be projectable into — the UI consumes this contract,
 * never raw agentManifest/SSE payload shapes directly. Fields are null when the
 * underlying signal genuinely doesn't exist yet (never fabricated to "look busy").
 */

import type { AuditAgentManifest } from '@sitenexis/shared';

export type AuditProgressStage =
  | 'AUDIT_STARTED'
  | 'VALIDATING_SITE'
  | 'DISCOVERING_URLS'
  | 'CRAWLING'
  | 'EXTRACTING'
  | 'ANALYSING_SEO'
  | 'ANALYSING_AI_VISIBILITY'
  | 'ANALYSING_CITATIONS'
  | 'ANALYSING_INFORMATION_GAIN'
  | 'ANALYSING_MACHINE_TRUST'
  | 'ANALYSING_GOVERNANCE'
  | 'RUNNING_SCOUT'
  | 'BUILDING_INTELLIGENCE'
  | 'GENERATING_REPORT'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export type ModuleState = 'COMPLETE' | 'ACTIVE' | 'WAITING' | 'PARTIAL' | 'UNAVAILABLE' | 'FAILED' | 'SKIPPED';

export type ExecutionMode = 'serverless' | 'bullmq' | 'unknown';

export interface ModuleStatus {
  /** Real agent key from AuditAgentManifest — e.g. 'crawl', 'semantic-trust' */
  id: string;
  label: string;
  state: ModuleState;
  /** The agent's own keyOutput / failureReason, when present — never fabricated */
  detail: string | null;
}

/** Raw input the pure calculation needs — everything sourced from real DB/SSE state. */
export interface AuditProgressInput {
  auditId: string;
  domain: string;
  executionMode: ExecutionMode;
  auditStatus: 'queued' | 'running' | 'partial' | 'complete' | 'failed';
  agentManifest: AuditAgentManifest | null;
  /**
   * Pages discovered/fetched so far. Both null until the serverless runner's
   * crawl-progress callback starts reporting a live count (see MAX_PAGES cap
   * in serverless-audit.ts) — before that, or on execution paths that don't
   * report it, this stays null rather than showing a fake 0.
   */
  pagesDiscovered: number | null;
  pagesFetched: number | null;
  /** Only known once the audit fully completes today — see limitations. */
  pagesRendered: number | null;
  pagesFailed: number | null;
  /** Epoch ms the audit actually started running (audit.startedAt, or createdAt as fallback). */
  startedAtMs: number;
  /** Injectable for deterministic tests; defaults to Date.now() at call sites. */
  nowMs: number;
  /** Present once the run has ended, for a stable elapsed/ETA at completion. */
  completedAtMs: number | null;
  errorMessage: string | null;
}

export interface AuditProgressState {
  auditId: string;
  executionMode: ExecutionMode;
  stage: AuditProgressStage;
  currentActivity: string;
  currentUrl: string | null;
  pagesDiscovered: number | null;
  pagesFetched: number | null;
  pagesRendered: number | null;
  pagesAnalysed: number | null;
  pagesFailed: number | null;
  activeModules: ModuleStatus[];
  completedModules: ModuleStatus[];
  unavailableModules: ModuleStatus[];
  elapsedMs: number;
  estimatedRemainingLabel: string;
  /** 0-100, monotonic for the lifetime of one audit, never 100 before the run truly ends. */
  progress: number;
  errorMessage: string | null;
  /** Plain-language notes about what this contract could NOT determine truthfully. */
  limitations: string[];
}
