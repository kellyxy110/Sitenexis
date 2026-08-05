# TASKS.md — SiteNexis Active Work Tracker

This file tracks multi-session efforts that are too large to hold in a single
conversation. Update status as work progresses. This is the file Claude Code
is expected to read at the start of any session touching one of these efforts.

---

## Second Brain — durable, evidence-grounded intelligence memory

**Status:** Phase 0 (forensic review) — in progress, partially blocked.

**Goal:** A durable memory system that remembers what SiteNexis previously
observed about a website across audits — score trajectories, issue lifecycle
(first seen / persisting / resolved / regressed), recommendation outcomes —
built entirely on persisted facts and deterministic derivations. Must remain
fully functional with every LLM provider disabled. See the original spec
(pasted in chat 2026-08-05) for the full 25-part requirement set; do not
re-derive it from memory — ask for it again if this file is being read cold
and the spec isn't in context.

**Non-negotiable:** canonical memory (scores, findings, issue status,
evidence, changes, regressions, recommendations) must never depend on an
LLM. LLMs may explain/summarize later, never originate.

### Phase 0 forensic findings — confirmed so far

1. **No existing "Second Brain" implementation.** Repo-wide grep for
   `second.?brain|SecondBrain|ChangeEngine|RegressionEngine|WebsiteMemory|
   HistoricalIntelligence|IssueLifecycle|WebEvidenceGraph` returns exactly
   one hit: a forward-reference comment in
   `apps/web/src/lib/audit-intelligence/report-generation-service.ts:17`
   ("the dashboard routes, the post-audit hook, and any future consumer
   (PDF, Second Brain) all go through `generateAndPersistIntelligenceReport`").
   No duplication risk from a prior attempt — but that comment marks the
   intended hook point.

2. **`packages/loop-os` — LoopOS V4.5 StateEngine — is LIVE prior art and
   must be treated as read carefully before designing anything new.**
   - Models: `SiteState` (schema.prisma:1364, one row **per domain**) and
     `MemoryRecord` (schema.prisma:1396, append-only event log:
     `score_snapshot | fix_applied | fix_verified | loop_checkpoint |
     issue_resolved | issue_opened | competitive_signal`).
   - Written after every complete audit from
     `apps/web/src/lib/serverless-audit.ts:1916-1956` ("StateEngine
     write-back"), wrapped in try/catch, logged, **never fails the audit**
     — this is the exact non-fatal post-completion pattern Second Brain
     must follow.
   - Read by `apps/web/src/app/api/monitoring/route.ts` (dashboard Score
     Monitoring page) and Telegram `commandMonitor`
     (`apps/web/src/lib/telegram-user/commands.ts:261-276`).
   - Query helpers: `packages/loop-os/src/state-engine/queries.ts` —
     `getSiteState`, `upsertSiteState`, `appendScoreSnapshot`,
     `recordIssueSet`, `recordLoopCheckpoint`.
   - **Critical flaw — must NOT be inherited by Second Brain:**
     `SiteState.domain` is `@unique` with **no `userId` scoping at all**.
     `getSiteState(domain)` returns the same row regardless of caller.
     `/api/monitoring/route.ts` authenticates the user and resolves *their
     own* latest audit's domain, but then queries `SiteState` by that raw
     domain string — so if a second, unrelated user later audits the same
     domain, both users silently share one score-history/open-issues/
     known-fixes record. This is a real, currently-shipping multi-tenant
     data-boundary gap. Second Brain tables must be keyed by
     `(userId, domain)` at minimum, matching how `Audit` itself is already
     correctly indexed (`schema.prisma:175-176`, both `userId` and
     `domain` indexed directly on `Audit`).
   - **Second flaw:** `recordIssueSet` (queries.ts:150-221) only ever
     *adds* to `resolvedIssues`, never removes an id from it when the
     issue reopens — so a regressed (reopened-after-resolved) issue can
     appear in both `openIssues` and `resolvedIssues` simultaneously.
     There is no `REGRESSED` classification anywhere in this system today.
   - Score history is an unstructured JSON array capped at 50 entries —
     no queryable per-metric delta schema.
   - **Open question, not yet resolved:** should Second Brain extend
     `SiteState`/`MemoryRecord` (fixing the tenancy bug) or build parallel,
     correctly-scoped tables and leave LoopOS untouched (it's still used
     live by Score Monitoring + `/monitor`)? Leaning toward the latter —
     LoopOS is mid-migration itself ("V4.5 — write-only, V5 reads it",
     per schema.prisma:1358-1362) and touching it is out of scope for a
     Second Brain phase unless its tenancy bug is separately reported and
     fixed as its own fix, not bundled into this feature.

3. **`AuditIntelligenceReport` (schema.prisma:298) is prose only, not
   deterministic memory.** Confirmed via `docs/CANONICAL_INTELLIGENCE_REPORT.md`
   and the live schema: one row per audit, holds the LLM-generated
   Executive Summary + Narrative Report JSON, idempotency-claimed
   generation (`claimReportGeneration`), Redis write-through cache with
   Postgres as source of truth. This is a different concern from what
   Second Brain needs (deterministic score/issue history) — not reusable
   as the memory store itself, but its idempotency-claim pattern
   (`generateAndPersistIntelligenceReport` in
   `apps/web/src/lib/audit-intelligence/report-generation-service.ts`) is
   the right pattern to copy for a Second Brain post-audit processor.
   **Doc/reality drift found:** `docs/CANONICAL_INTELLIGENCE_REPORT.md`
   still says "Status: schema drafted, NOT applied to any database" — this
   is now stale; the table is live in production (confirmed in current
   `schema.prisma` and via prior task history). Needs a doc fix,
   independent of Second Brain — noted here so it isn't lost.

4. **`Audit` model is the correct tenancy pattern to copy:** `userId` and
   `domain` both indexed directly on `Audit` (schema.prisma:107-178).

5. **`Issue` model (schema.prisma:232) has no stable cross-audit identity.**
   `id` is a fresh cuid per audit run. Available fields for a fingerprint:
   `module`, `type`, `pageUrl`, `severity` (all scoped to one `auditId`).
   No fingerprint/dedup column exists on the table itself today.

6. **RESOLVED — `intelligence-report-v2` has no reusable cross-audit
   identity; Second Brain must build its own fingerprint.** Confirmed via
   `apps/web/src/lib/intelligence-report-v2.ts` (the only real consumer
   entry point, `projectStoredAuditToIntelligenceReportV2`) and its sole
   caller, `apps/web/src/app/api/audits/[auditId]/intelligence-report-v2/route.ts`
   (grep-confirmed — exactly one route uses this). It is a **read-time-only
   projection**: given an already-fetched audit's `pages`/`issues` from
   Postgres, it re-projects them into the v2 canonical shape on every
   request — no DB writes happen in this path, nothing is persisted
   separately, and it is not called from `serverless-audit.ts` or any
   score-writing path. Its "finding identity" for legacy issues is just
   `legacy:issue:${issue.id}` — a passthrough of the same fresh-per-audit
   `Issue.id`, not a new stable fingerprint. **Verdict: this system is
   entirely about within-a-single-audit evidence consistency
   (contradiction-free, eligibility-checked reporting), not cross-audit
   memory. Second Brain is a genuinely new, complementary layer and should
   fingerprint issues independently** (module + type + normalized pageUrl,
   scoped by domain/userId) rather than trying to extend this system.

   (Original unresolved framing, kept for context — now answered above.)
   Large system exists in
   `packages/shared/src/` — `canonical-finding-projection.ts`,
   `canonical-intelligence-report-v2.ts`,
   `canonical-intelligence-report-v2-assembly.ts`,
   `evidence-contradictions.ts`, `root-cause-grouping.ts`,
   `intelligence-module-state.ts`, `legacy-evidence-projection.ts`,
   `raw-rendered-evidence-projection.ts`, `scoring-v2-category-engine.ts`,
   `scoring-v2-input-projection.ts`, plus a doc set at
   `docs/intelligence-report-v2*.md` and tests in
   `packages/analyzers/src/intelligence-report-v2/__tests__/`.
   **This is the single most important open unknown before finalizing the
   Second Brain schema.** Specifically unresolved:
   - Does `canonical-finding-projection.ts` already define a stable
     cross-audit Finding identity? If yes, Second Brain's issue
     fingerprint should be built on top of it, not invented independently
     on the raw `Issue` table.
   - Is this v2 system actually wired into the live audit pipeline, or is
     it a parallel/in-progress track? (Read
     `docs/intelligence-report-v2-current-state.md` first — it's likely
     the authoritative "what's actually built" summary.)
   - Does `evidence-contradictions.ts` / `root-cause-grouping.ts` operate
     only within a single audit, or does anything already compare across
     audits over time?
   - `docs/evidence-model.md`'s proposed `EvidenceProjection` contract
     lists a `HISTORICAL_DATABASE` source layer ("prior observed state")
     — confirm whether this is implemented or still just a proposal.

7. **No `Website` model exists in schema.** Websites are implicit — derived
   as distinct `domain` values from a user's own `Audit` rows.
   `getUserWebsiteDomains` is referenced from
   `apps/web/src/lib/telegram-user/__tests__/commands.test.ts` — its
   actual definition/file and scoping have not yet been confirmed.

### Phase 0 — resolved directly (no subagents, after the session usage-limit interruption)

- **Website concept confirmed**: `getUserWebsiteDomains(userId)` —
  `packages/db/src/queries/telegram-connections.ts:211-224`. Properly
  scoped (`where: { userId, archivedAt: null }`), groups the user's own
  `Audit` rows by domain, most-recent-first. This is the T2 "website
  foundation" — confirmed no persisted `Website` table exists; this is the
  pattern Second Brain must follow for tenancy scoping.
- **Canonical services inventory confirmed complete** (grepped
  `apps/web/src/lib/audit-intelligence/*.ts` exports directly):
  `getAuditScorecard`, `getAuditIssueSummary`, `getAuditFixPlan`,
  `getAuditEvidenceSummary`, `getExecutiveSummary`, `getNarrativeReport`,
  `resolveAuditForDomain`, `generateAndPersistIntelligenceReport`. (No
  `getScoutAnalysis` in this directory — Scout's read path lives
  elsewhere, in `packages/analyzers`/Telegram scout-command, per the
  existing architecture boundary rule already in CLAUDE.md.)
- **Fix Plan confirmed real and live**: `getAuditFixPlan`
  (`apps/web/src/lib/audit-intelligence/recommendations.ts:10-83`) calls
  `buildFixPlan` (pure function, `@sitenexis/analyzers`) against
  `Issue` rows plus optional sub-report issues (`TrustIssue`,
  `TemporalIssue`, `RetrievalFailure`, `CoverageGap`, `SyntheticPattern`).
  **FixPlan item identity = the same underlying `Issue.id`** (or the
  equivalent sub-report item) — no separate stable id. This means Issue
  Memory and Recommendation Memory (spec §4 and §6) can and should share
  **one fingerprint scheme** — a FixPlan recommendation is just a
  filtered/prioritized view of the same issues Second Brain will already
  be fingerprinting.
- **GTL response envelope confirmed** — `apps/web/src/lib/gtl.ts`:
  `{ state: 'complete'|'partial'|'empty', timestamp, data }`, with
  `resolveGTLState(auditStatus, hasData)` as the standard resolver. Every
  new Second Brain API route must return this exact envelope shape for UI
  consistency with the rest of the dashboard.
- **`isFullyConfigured()`** — `apps/web/src/lib/mode.ts:14` — checks
  `DEMO_MODE` and real (non-placeholder) Supabase config. The known bug
  pattern (memory: `isfullyconfigured_gate_bug.md`) is routes calling this
  and returning `gtlEmpty()` even when real DB data exists — Second Brain
  routes must gate ONLY on "is the DB itself configured," never as a
  proxy for "does data exist yet" (that's `resolveGTLState`'s job).
- **Idempotent post-audit hook pattern confirmed and directly reusable**:
  `generateAndPersistIntelligenceReport`
  (`apps/web/src/lib/audit-intelligence/report-generation-service.ts:154-158`)
  uses `claimReportGeneration(auditId)` as an atomic DB-level
  compare-and-swap claim — a retried/replayed/concurrent call is a safe
  no-op for every caller except the one that wins the claim. Second Brain
  should add an analogous `claimSecondBrainProcessing(auditId)` claim
  rather than inventing a new idempotency mechanism.
- **GA4/GSC boundary confirmed clean**: grepped `apps/web/src/app/api/cron`
  for `AuditScore|AIVisibilityScore` — zero hits. The existing
  `correlateScoresWithTraffic` (`packages/analyzers/src/ai-visibility-insights/score-traffic-correlation.ts:38`)
  is a pure function taking already-fetched audits + traffic/search points
  as plain arguments — no DB writes, no score mutation. This is exactly
  the outcome-evidence pattern (spec §7) to copy: GA4/GSC data is read,
  correlated for display, never written back into canonical scores.

### Still open (low priority, does not block schema design)

- Conversational Scout's `ScoutChatContext` extensibility for later
  historical-context injection (spec §15) — deferred, since the spec
  explicitly says not to touch Scout substantially in this phase.
- Exact `Redis` client module path for the write-through cache pattern to
  copy (functionally already confirmed via
  `report-generation-service.ts` §5 of `docs/CANONICAL_INTELLIGENCE_REPORT.md`
  — Postgres source of truth, Redis best-effort cache, failures swallowed
  not thrown — just haven't cited the exact client file path).

**Phase 0 forensic review: complete, accepted.** Architecture approved
2026-08-05; schema application explicitly withheld pending a
schema-hardening pass (enums, issue-identity algorithm, idempotency,
foreign keys, rebuildability). See chat for the full hardened schema
proposal. Do not run `db:push` or write Phase 1+ code until that proposal
is explicitly approved.

### Schema-hardening pass — key findings (2026-08-05)

- **Issue fingerprint decided: `sha256(userId + domain + module + '::' + type)`**,
  NOT including `pageUrl` or any recommendation text. Confirmed via two
  independent sources that `module` + `type` is already the codebase's de
  facto stable rule identity: (1) `packages/shared/src/legacy-evidence-projection.ts:126,130`
  sets `issueCode: present(issue.type)` and `moduleId: issue.module` when
  projecting legacy issues into the v2 evidence shape; (2) the canonical
  dedupe module `packages/analyzers/src/issues/dedupe.ts` — used by Action
  Plan, Fix Plan, PDF, Executive Summary, and Narrative Report, i.e. every
  existing report surface — deliberately collapses the same
  `module`+`type` fix across every affected page into ONE group
  (`dedupeExact`, `dedupe.ts:74-84`), tracking `affectedUrls[]` as data on
  the group, not as part of its identity. Fingerprinting per-page would
  make Second Brain disagree with every other surface about what counts
  as "one issue" — exactly the surface-inconsistency class this codebase
  has repeatedly fixed elsewhere (see `docs/CANONICAL_INTELLIGENCE_REPORT.md`).
  `Issue.type` values are confirmed hand-authored deterministic constants
  (`missing_alt_text`, `missing_canonical`, etc. — grepped directly in
  analyzer source), never LLM-generated, so this is prose-independent as
  required. Versioned via `fingerprintVersion` column, default `"v1"`.
- **`dedupeExact`'s cross-module pass (`collapseCanonicalTopics`,
  `dedupe.ts:130-158`) is intentionally excluded from the fingerprint** —
  it's regex/text matching against `recommendation`+`message`, which is
  exactly the kind of prose-dependent matching the spec said to avoid for
  identity. Consequence: a single Fix Plan action that
  `collapseCanonicalTopics` merges across modules (e.g. "add sameAs
  links") can correspond to more than one `IssueMemory` row underneath —
  intentional; `RecommendationOutcome` is tracked at the `IssueMemory`
  grain, not at the "as-displayed Fix Plan card" grain.
- **`buildFixPlan` confirmed one-item-per-dedupe-group** (`packages/analyzers/src/fix-plan/engine.ts:192-193`)
  — so `issueMemoryId + recommendedAtAuditId` is sufficient identity for
  `RecommendationOutcome`; no separate recommendation fingerprint needed.
- **Processing claim pattern**: mirrors `claimReportGeneration`
  (`packages/db/src/queries/audit-intelligence-report.ts:42-62`) exactly —
  `updateMany` with a `WHERE status IN (pending,failed) OR (status=processing AND updatedAt < staleBefore)`
  guard is Postgres's own row-level atomicity acting as a compare-and-swap;
  the stale-timeout clause is what makes crash recovery and rebuild safe.
  One new table, `SecondBrainProcessingRun` (one row per audit), not
  scattered claim columns — reuses the proven pattern instead of
  inventing a new one.
- **Enum casing**: repo convention is actually split — simple "current
  state" enums are lowercase (`AuditStatus`, `IssueSeverity`,
  `GoogleConnectionStatus`, `ReportGenerationStatus`), but the one
  existing append-only **event-log** enum, `TelegramConnectionEventType`
  (`schema.prisma:1839-1844`), is SCREAMING_SNAKE_CASE — and
  `IssueLifecycleEvent` is structurally identical to
  `TelegramConnectionEvent` (both narrow, append-only audit trails). Used
  SCREAMING_SNAKE_CASE for all four new enums, matching that closest
  structural analog and the casing given verbatim in the spec.
- **Correction pass 2026-08-05 (schema now written to `packages/db/schema.prisma`,
  validated locally, NOT pushed):** added direct `User` FKs (`onDelete: Restrict`)
  to `AuditChange` and `IssueMemory` — tenancy is never an unconstrained
  string; renamed `resolvedAuditId` → `lastResolvedAuditId` (relation
  `IssueMemoryLastResolvedAudit`), preserved on regression, updated on
  re-resolution, full transition history remains in
  `IssueLifecycleEvent`; added `WebsiteMemory.firstAuditAt` (denormalized
  canonical audit timestamp) so "earliest eligible audit" backfill is a
  strictly-earlier-wins compare-and-set, idempotent under reprocessing.
  Service-level tenant invariant to enforce and test at the write boundary
  (not a DB constraint — no unique `(userId, domain)` key exists on
  `Audit` to hang a composite FK off):
  `audit.userId === row.userId && normalizeDomain(audit.domain) === normalizeDomain(row.domain)`.
  `prisma validate` and `prisma generate` both pass locally; `git diff --stat`
  confirms the change is scoped to exactly `schema.prisma` (+241 lines,
  additive only). No `db push`/`migrate` run.
- **FK `onDelete`: `Restrict` everywhere**, matching the only two existing
  precedents that touch this decision — `AuditIntelligenceReport`'s
  applied migration (`ON DELETE RESTRICT ON UPDATE CASCADE`,
  `docs/CANONICAL_INTELLIGENCE_REPORT.md` §3.2) and
  `TelegramConnection.user`'s explicit `onDelete: Restrict`
  (`schema.prisma:1795`). Consistent with CLAUDE.md's "soft deletes only,
  never hard-delete" — Audits and Users are never actually hard-deleted in
  this codebase, so Restrict is a safety net that should never trigger in
  practice, not a real constraint on normal operation.

### Explicit gates from the original spec (do not skip)

- Do not write or apply any Prisma migration without pasting the exact
  schema diff / resulting SQL / rollback plan and getting explicit
  approval in chat first — same process already demonstrated in
  `docs/CANONICAL_INTELLIGENCE_REPORT.md` §3, reuse that format.
- Do not commit, push, or deploy Second Brain code until validation is
  complete and explicitly approved.
- No Second Brain Telegram commands yet. No GA4/GSC exposure in Telegram,
  ever. Do not modify the Ops bot.
- Second Brain failure must never fail the underlying audit.

### Phase 1 (SB1) — deterministic core: complete, validated, awaiting review (2026-08-05)

**Status:** Schema applied to production. Change Engine, Issue Memory
Engine (doubling as Regression Engine), WebsiteMemory resolver, and
persistence layer all implemented as pure/tested functions. Post-audit hook
wired into `serverless-audit.ts`. Full validation pass clean. **Not yet
committed, pushed, or deployed** — holding per explicit instruction pending
review of the final report delivered in chat.

- Schema: 5 enums + 6 tables applied via `prisma db push`, verified
  directly against production Postgres (tables, enums, unique indexes, all
  14 FKs confirmed `RESTRICT`, existing `audits`/`users` row counts
  unchanged, zero rows in all 6 new tables — no auto-backfill).
- Engines: `packages/analyzers/src/second-brain/` — `change-engine.ts`,
  `issue-fingerprint.ts`, `issue-lifecycle-engine.ts`, `website-memory.ts`,
  `audit-history.ts`, `types.ts`. 41 tests passing.
- Persistence: `packages/db/src/queries/second-brain.ts` — tenant-scoped
  claim/write helpers, `assertAuditTenantScope` enforced before every
  write. 16 tests passing.
- Orchestration: `apps/web/src/lib/second-brain/process-audit.ts`, hooked
  into `serverless-audit.ts` immediately after `updateAuditStatus` (not
  co-located with the pre-existing LoopOS write-back, which runs before
  status is set — Second Brain needs the audit's own status already
  correct when it re-fetches the row). Non-fatal, idempotent, never throws
  into the audit path. 11 tests passing.
- Full validation: `apps/web` typecheck clean; full `apps/web` test suite
  801/817 passing — the 16 failures are pre-existing and unrelated,
  confirmed by stashing all Second Brain changes and reproducing the same
  16 failures on a clean tree (5 are the known Vitest concurrent-dynamic-import
  flakiness under full-suite parallel load — see "Known Technical Debt" in
  CLAUDE.md — and pass 72/72 when run in isolation; the other 3 are a
  pre-existing bug in the unrelated `ai-correlation` GA4/GSC route). Lint
  clean (pre-existing warnings only, no new ones). Production build clean,
  9/9 tasks. `git diff --check` clean. Secret scan clean on both the
  tracked diff and all new untracked files.
- **Known limitation, explicitly deferred, not silently dropped:**
  `RecommendationOutcome` computation was not wired into the orchestration
  hook this phase. The persistence primitive (`upsertRecommendationOutcome`)
  exists but nothing calls it — the Phase 1 instructions' engine list
  (Change/Issue Memory/Regression/WebsiteMemory) did not include a
  Recommendation Engine, and inventing its computation logic wasn't
  authorized. Needs its own explicitly-scoped phase.
- Per instruction: no UI, no Scout integration, no Telegram exposure, no
  GA4/GSC correlation, no bulk historical backfill, no LoopOS tenancy fix,
  no embeddings, no AI summarization were started. LoopOS tenancy gap
  remains tracked separately (see `docs/DECISION_LOG.md`, 2026-08-05
  entry) and untouched.
