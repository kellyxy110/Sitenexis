# Intelligence Report v2 migration contract

## Future changes only

No migration is applied by Phase 1. Future migrations must be additive, nullable or defaulted, and rollback-friendly.

## Proposed additions

1. Add optional version metadata to Audit or an append-only version table: scoring model, report, evidence model, crawler version.
2. Add append-only EvidenceProjection records related to Audit and optionally Page/Issue.
3. Add report-v2 snapshot records with coverage, confidence, methodology, input hashes, and generation status.
4. Add root-cause groups and score-impact records only after projection tests exist.

## Rules

- Never reset or delete production data.
- Never make an old row invalid.
- Never silently recalculate a historical score.
- Keep v1 report and export readers independent from v2 records.
- A v2 write failure must not fail the audit.
- Rollback disables v2 reads/writes while preserving old and new rows.

Migration review must include Prisma schema diff, generated SQL review, empty and legacy row tests, rollback behavior, worker/serverless writes, and export compatibility.
