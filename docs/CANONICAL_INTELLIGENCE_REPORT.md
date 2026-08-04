# Canonical Intelligence Report — Design & Migration Proposal

Status: **schema drafted, NOT applied to any database.** This document is the
review artifact requested before running `prisma db push` against production.
No migration has been run. See [Migration Proposal](#migration-proposal) for
the explicit stop point.

## 1. Problem this fixes

Before this change, the prose "Intelligence Report" (Executive Summary +
Narrative Report) existed only as a Redis cache entry, written once by
whichever surface happened to trigger generation first (dashboard,
`/api/audit/[id]/report`, or the Telegram bot), each with its own
generate-on-read logic. This produced three independent failure modes:

- **Redis eviction / TTL expiry silently regenerated content** — a second LLM
  call, on a random schedule, for the same audit, sometimes producing
  different prose from the first (LLM output is not guaranteed byte-stable).
- **Surface inconsistency** — one surface's cache could be warm while
  another's was cold, so the dashboard and Telegram could show materially
  different summaries for the same audit at the same moment.
- **No durable record** — restarting Redis, or Redis simply falling out of
  quota (as happened in production, see `verification_2026_07_14` memory),
  meant the report was gone until something re-triggered generation.

## 2. Architecture

Redis is demoted to a pure performance cache in front of a new Postgres
table. Generation happens exactly once per audit, in a single service
(`generateAndPersistIntelligenceReport` in
`apps/web/src/lib/audit-intelligence/report-generation-service.ts`), gated by
a DB-level idempotency claim (`claimReportGeneration`). Every consumer —
dashboard routes, Telegram Audit Intelligence, and the HTML "Full Report"
export — now reads through `getExecutiveSummary` / `getNarrativeReport`,
which check Postgres first (source of truth) and use Redis only as a fast
path, never as the only copy.

```
Audit completes
  → generateAndPersistIntelligenceReport(auditId)
      → claimReportGeneration(auditId)   [DB-level idempotency lock]
      → assemble context (scores, issues, entities, machine trust, ...)
      → generate executive summary (LLM) + narrative report (LLM), independently
      → saveGeneratedReport(auditId, { executiveSummary?, narrativeReport?, status })
      → write-through to legacy Redis keys (best-effort, never blocks on failure)

Any surface reads:
  getExecutiveSummary(auditId) / getNarrativeReport(auditId)
    → Postgres (AuditIntelligenceReport row) — source of truth
    → Redis — cache only, repopulated from Postgres on miss
```

Partial failure is a first-class state: if only one of the two LLM calls
succeeds, the report is saved with `status: 'partial'` and whichever artifact
succeeded — never all-or-nothing.

## 3. Migration Proposal

This project has **no tracked Prisma migration history** — confirmed via:

- `packages/db/package.json`: `"db:push": "prisma db push"` is the script
  actually used; `"db:migrate": "prisma migrate dev"` exists but there is no
  `packages/db/migrations/` directory, so it has never been exercised.
- Every existing table in production was created by `prisma db push` against
  `schema.prisma` directly.

So the correct framing for this change is **not** a numbered migration file —
it's "the additive diff `prisma db push` will apply to `schema.prisma`."

### 3.1 What's already in `schema.prisma` (drafted, not pushed)

- A new enum `ReportGenerationStatus` (`pending | generating | ready | partial | failed`).
- A new model `AuditIntelligenceReport`, mapped to table `audit_intelligence_reports`.
- One new back-relation field on `Audit`: `intelligenceReport AuditIntelligenceReport?`
  — this is relation-only and produces **no new column on the `audits` table**.
  The foreign key lives entirely on the new table.

### 3.2 Exact resulting SQL

This is additive-only DDL. Nothing existing is altered, renamed, or dropped.

```sql
-- New enum type
CREATE TYPE "ReportGenerationStatus" AS ENUM ('pending', 'generating', 'ready', 'partial', 'failed');

-- New table
CREATE TABLE "audit_intelligence_reports" (
    "id"                          TEXT NOT NULL,
    "audit_id"                    TEXT NOT NULL,
    "status"                      "ReportGenerationStatus" NOT NULL DEFAULT 'pending',
    "executive_summary"           JSONB,
    "executive_summary_version"   TEXT,
    "narrative_report"            JSONB,
    "narrative_report_version"    TEXT,
    "provider"                    TEXT,
    "model"                       TEXT,
    "last_error"                  TEXT,
    "generated_at"                TIMESTAMP(3),
    "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_intelligence_reports_pkey" PRIMARY KEY ("id")
);

-- Uniqueness: one report row per audit
CREATE UNIQUE INDEX "audit_intelligence_reports_audit_id_key"
    ON "audit_intelligence_reports"("audit_id");

-- Lookup index used by any future "find all pending/failed reports" admin query
CREATE INDEX "audit_intelligence_reports_status_idx"
    ON "audit_intelligence_reports"("status");

-- Foreign key back to the existing audits table
ALTER TABLE "audit_intelligence_reports"
    ADD CONSTRAINT "audit_intelligence_reports_audit_id_fkey"
    FOREIGN KEY ("audit_id") REFERENCES "audits"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

No `ALTER TABLE "audits" ...` statement is generated — the `intelligenceReport`
field on the `Audit` model is a pure Prisma-client back-relation, not a column.

### 3.3 How to apply it (when approved)

```bash
pnpm db:push
# equivalent to: pnpm --filter @sitenexis/db exec prisma db push
```

Prisma will print this exact diff for confirmation before writing anything,
since `db push` always shows a plan first in an interactive terminal.

### 3.4 Rollback

Purely additive and leaf-level (nothing else references
`audit_intelligence_reports`), so rollback is a clean drop with no
cascading impact on any other table:

```sql
DROP TABLE "audit_intelligence_reports";
DROP TYPE "ReportGenerationStatus";
```

### 3.5 Expected production impact

- **Near-zero.** No column is added to `audits` or any other existing table,
  so there is no table rewrite and no lock contention on large existing
  tables.
- Creating a new table + enum + two indexes is a fast, constant-time DDL
  operation regardless of how much data already exists in `audits`.
- No data backfill is required or performed by this migration — existing
  audits simply have no `AuditIntelligenceReport` row until either the
  automatic post-audit hook (for new audits) or the explicit admin backfill
  endpoint (for historical audits, not yet invoked — see §4) creates one.

### 3.6 Explicit stop

**This migration has not been applied to any environment.** Per instruction,
I will not run `pnpm db:push`, `prisma db push`, or `prisma migrate` against
production (or any shared environment) without separate, explicit approval
in chat. This document is the review artifact for that approval — the
`schema.prisma` changes described above are already written and can be
inspected with `git diff packages/db/schema.prisma`.

## 4. Historical backfill (not run)

`POST /api/admin/audit-intelligence/backfill` accepts exactly one
`{ auditId }` per call, gated to the owner allowlist
(`kellyxy110@gmail.com`, `luchijudith@gmail.com`, `judithluchi@gmail.com`).
There is intentionally no bulk/"backfill everything" endpoint — regenerating
prose for the full historical audit corpus in one shot is an uncontrolled
LLM-cost action, so an administrator must name each audit explicitly. It
reuses the same `claimReportGeneration` idempotency as the automatic path,
so calling it twice for an already-`ready` report is a safe no-op.

**This endpoint has not been invoked against any real audit**, including
truvyx.org, per instruction.

## 5. Redis's new role

Redis keys `exec-summary:{auditId}:{version}` and
`narrative:{auditId}:{version}` are still written on every successful
generation (write-through), so the existing fast-path read in front of
Postgres keeps working unchanged. The difference is that a Redis miss,
eviction, or outage is now fully recoverable — every read path falls back to
Postgres, and a write failure to Redis is caught and swallowed (logged, not
thrown), because Redis is explicitly a cache, not the record of truth.

## 6. PDF / export surface findings

- `packages/analyzers/src/reports/generator.ts` (`generateAuditReport`, a
  deterministic `@react-pdf/renderer`-based generator with S3 upload and
  SHA-256 signing) is **dead code** — exported from the analyzers barrel but
  has zero consumers anywhere in `apps/web`. It contains no AI/LLM
  involvement, so it was not a source of the inconsistency bug; left
  untouched.
- The actual production "Full Report" download,
  `apps/web/src/app/api/audit/[id]/report/route.ts`, had its own independent
  raw Redis-only read (`createRedisClient` → `client.get('exec-summary:...')`)
  that completely bypassed the new canonical `getExecutiveSummary` service.
  This was a real, previously undetected instance of the exact
  surface-inconsistency bug class this project targets: the HTML export
  could show "Not yet generated" even when the canonical DB report was
  ready. Fixed by routing through `getExecutiveSummary`, with 6 new tests
  added (this route previously had none).
