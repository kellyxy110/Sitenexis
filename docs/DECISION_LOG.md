# Decision log

## 2026-07-29: Page-level crawl evidence

Decision: Store page identity and page evidence separately.

Reason: A declared canonical can point to another URL. It must not replace the URL that SiteNexis crawled.

Page records now distinguish requested URL, normalized requested URL, final URL after redirects, and declared canonical URL.

Decision: Use the normalized requested URL for lookup within one audit.

Reason: Fragments, default ports, duplicate slashes, and trailing slash differences must not create accidental duplicate page records.

Decision: Replace all page-specific fields on update.

Reason: A retry can return no canonical or different content. The database must not keep old values from a previous response.

Decision: Store all H1 and H2 evidence and a content hash.

Reason: The report must show the real heading list for each URL. A content hash makes cross-page contamination easy to detect.

Decision: Use deterministic extraction for values and AI only for explanation.

Reason: AI must not invent a heading, canonical, or page value.

Migration: The new Page fields are additive. Use Prisma db push after review. Do not delete or reset production data.
## 2026-07-29: Canonical link extraction

Decision: Select canonical only from a link element whose rel token list contains the canonical token.

Reason: The previous parser could select a preload link when preload appeared before the declared canonical link.

Decision: Keep extracted canonical evidence separate from diagnostic health.

Reason: `https://truvyx.org/` is the declared canonical on the selected pages. It is not a self-canonical for those pages. SiteNexis must report the declaration and then explain the non-self-referencing diagnostic.

Validation: 16 canonical regression tests and 105 adapter tests pass. Five live Truvyx pages return the declared homepage canonical. Production API, dashboard, CSV, and PDF values remain unverified until authenticated access is available.

## 2026-08-05: Second Brain — do not extend LoopOS StateEngine's domain-only keying

Decision: Any new historical-intelligence ("Second Brain") tables must be
keyed by `(userId, domain)` at minimum, following the pattern already used
on `Audit` (`userId` and `domain` both indexed directly, schema.prisma:175-176)
— never by raw domain alone.

Reason: `packages/loop-os`'s existing `SiteState` model
(schema.prisma:1364) is keyed `domain: String @unique` with no `userId`
scoping. `getSiteState(domain)` returns the same row for any caller.
`/api/monitoring/route.ts` authenticates the user and resolves their own
latest audit's domain correctly, but the downstream `SiteState` read is
not itself scoped to that user — so two unrelated users auditing the same
domain silently share one score-history/open-issues/known-fixes record.
This is a live multi-tenant data-boundary gap in production, not a
hypothetical risk. It must not be inherited by any new system.

Decision: Do not fix the LoopOS tenancy gap as part of Second Brain work.

Reason: LoopOS is itself mid-migration ("V4.5 — write-only, V5 reads it",
schema.prisma:1358-1362) and is live behind Score Monitoring + Telegram
`/monitor`. Fixing its tenancy boundary is a separate, standalone fix with
its own blast radius and should be scoped and approved independently, not
bundled into an unrelated feature.

Decision: Second Brain's issue-lifecycle tracking must support a REGRESSED
state distinct from LoopOS's current issue tracking.

Reason: `recordIssueSet` (packages/loop-os/src/state-engine/queries.ts:150-221)
only ever adds ids to `resolvedIssues`, never removes one when the issue
reopens — so a reopened issue can appear in both `openIssues` and
`resolvedIssues` at once, and there is no REGRESSED classification at all
today. Second Brain's Change/Regression Engine must not replicate this.

Status: Phase 0 forensic review in progress — see `TASKS.md` for full
findings and open questions. No schema has been written or applied yet.