// LoopOS V4.5 — Type Definitions
// All LoopOS primitives are defined here. No type may be redefined locally in
// consuming packages. Import from @sitenexis/loop-os.

// ── Score snapshot ────────────────────────────────────────────────────────────

export type ScoreSnapshot = {
  auditId: string
  capturedAt: string              // ISO 8601
  overall: number                 // 0–100 composite
  aiVisibilityScore: number
  citationProbabilityScore: number
  semanticTrustScore: number
  entityConfidenceScore: number
  retrievalReadinessScore: number
  machineReadabilityScore: number
  seoScore: number
  schemaScore: number
  performanceScore: number
  // v3 scores — nullable on audits that predate Layer 4
  retrievalQualityScore: number | null
  machineTrustScore: number | null
  authorityVelocityScore: number | null
  recommendationSurfaceScore: number | null
  entityAuthenticityScore: number | null
}

// ── Known / failed fix records ────────────────────────────────────────────────

export type KnownFix = {
  issueType: string               // matches Issue.type in DB
  fixDescription: string
  appliedAt: string               // ISO 8601
  scoreGain: number               // delta in the relevant score after next audit
  affectedDimension: string       // which score dimension improved
  auditIdBefore: string
  auditIdAfter: string
}

export type FailedFix = {
  issueType: string
  fixDescription: string
  attemptedAt: string             // ISO 8601
  scoreChange: number             // 0 or negative — why it's in failedFixes
  failureReason: string           // 'no_improvement' | 'score_regressed' | 'not_detected_after'
  auditIdBefore: string
  auditIdAfter: string
}

// ── Loop checkpoint ───────────────────────────────────────────────────────────

export type LoopType =
  | 'engineering'
  | 'research'
  | 'content'
  | 'trust'
  | 'competitive'

export type LoopCheckpoint = {
  loopType: LoopType
  checkpointId: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  startedAt: string               // ISO 8601
  completedAt: string | null
  outputSummary: string           // one sentence — what this loop run produced
  loopRunId: string               // FK to loop_jobs once that table exists (V5)
}

// ── SiteState — the core LoopOS primitive ────────────────────────────────────
//
// One record per domain. Upserted after every complete audit.
// In V4.5: write-only. Loops read in V5.

export type SiteState = {
  id: string
  domain: string
  lastAuditId: string | null
  lastAuditCompletedAt: string | null   // ISO 8601

  // Capped at 50 most recent snapshots — older snapshots archived in JSON blob
  scoreHistory: ScoreSnapshot[]

  // Active issue IDs from the most recent audit
  openIssues: string[]

  // Issue IDs resolved (present in a previous audit, absent in the current one)
  resolvedIssues: string[]

  // Fixes confirmed to have worked (positive score delta after next audit)
  knownFixes: KnownFix[]

  // Fixes applied that produced no improvement or regression
  failedFixes: FailedFix[]

  // Most recent checkpoint per loop type
  loopCheckpoints: LoopCheckpoint[]

  // LoopType → ISO 8601 of last run
  lastLoopRunAt: Partial<Record<LoopType, string>>

  createdAt: string               // ISO 8601
  updatedAt: string               // ISO 8601
}

// ── Patch types for upsert operations ────────────────────────────────────────

export type SiteStatePatch = {
  lastAuditId?: string
  lastAuditCompletedAt?: string
  scoreHistory?: ScoreSnapshot[]
  openIssues?: string[]
  resolvedIssues?: string[]
  knownFixes?: KnownFix[]
  failedFixes?: FailedFix[]
  loopCheckpoints?: LoopCheckpoint[]
  lastLoopRunAt?: Partial<Record<LoopType, string>>
}

// ── MemoryRecord — write-only in V4.5, consumed by loops in V5 ───────────────

export type MemoryRecordType =
  | 'score_snapshot'
  | 'fix_applied'
  | 'fix_verified'
  | 'loop_checkpoint'
  | 'issue_resolved'
  | 'issue_opened'
  | 'competitive_signal'

export type MemoryRecord = {
  id: string
  domain: string
  recordType: MemoryRecordType
  payload: Record<string, unknown>    // typed by recordType — see MemoryRecordPayloads below
  auditId: string | null
  loopRunId: string | null            // null in V4.5 (no loops yet)
  createdAt: string                   // ISO 8601
}

// Payload shapes per record type — use these for narrow typing at write sites

export type ScoreSnapshotPayload = {
  snapshot: ScoreSnapshot
}

export type FixAppliedPayload = {
  issueType: string
  fixDescription: string
  appliedAt: string
  auditIdBefore: string
}

export type FixVerifiedPayload = {
  issueType: string
  scoreGain: number
  affectedDimension: string
  auditIdBefore: string
  auditIdAfter: string
}

export type LoopCheckpointPayload = {
  loopType: LoopType
  checkpointId: string
  outputSummary: string
}

export type IssueOpenedPayload = {
  issueId: string
  issueType: string
  severity: 'critical' | 'warning' | 'info'
  module: string
}

export type IssueResolvedPayload = {
  issueId: string
  issueType: string
  resolvedAfterAuditId: string
}

// ── LoopJob — placeholder for V5 (type defined here for forward compatibility) ─

export type LoopJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'partial'

export type LoopJob = {
  id: string
  domain: string
  loopType: LoopType
  status: LoopJobStatus
  triggeredBy: 'audit_complete' | 'schedule' | 'manual' | 'state_change'
  inputSummary: string
  outputSummary: string | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  createdAt: string
}
