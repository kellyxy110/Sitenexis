# SiteNexis dashboard pipeline audit

This inventory traces the dashboard surface as implemented in the repository. The
shared path is: `POST /api/audit/start` → `runServerlessAudit` or the BullMQ crawl
worker → `packages/agents` and `packages/analyzers` → Prisma query helpers →
`/api/audit/[id]/*` → dashboard pages. The audit is currently represented by one
status field and result tables; there is no durable per-agent execution record.

## Shared findings

| Area | Current implementation | Failure / risk | Proposed repair | Test |
|---|---|---|---|---|
| Audit start | `apps/web/src/app/api/audit/start/route.ts` validates the domain, creates an `Audit`, then schedules BullMQ or `after()` serverless work | `after()` is not a durable queue; a terminated request can leave a queued audit forever | Persist an execution manifest and use the durable worker when available; make serverless execution idempotent and retryable | start route, retry, stuck audit |
| Crawl and agents | `apps/web/src/lib/serverless-audit.ts`, `packages/agents/src/*` | Many layer-4 writes are `Promise.allSettled` and completion does not inspect required failures | Record each agent as pending/running/completed/partial/failed; complete only when required outputs are persisted | complete, partial failure |
| Persistence | `packages/db/src/queries/*.ts`, `packages/db/schema.prisma` | Results are mostly audit-scoped, but no common contract or write manifest exists; some generated defaults turn unavailable values into zero | Add a durable agent-run/result contract, explicit null/no-data states, idempotent upserts, and completion validation | result validation, idempotent write |
| API retrieval | `/api/audit/[id]/*`, `getAuditWithResults` | `getAuditWithResults(id)` and many module queries do not accept `userId`; routes perform authorization after fetching | Scope every query by `id + userId`, including history, comparisons, cache keys, and jobs | tenant isolation |
| Live progress | `/api/audit/[id]/stream`, `apps/web/src/components/AuditProgress.tsx` | Stream reports only crawl/report stages and cannot show agent counts; a complete audit can have no persisted agent evidence | Return agent manifest snapshots and derive truthful overall status | live progress, empty completed audit |
| UX | `apps/web/src/app/dashboard/[...slug]/page.tsx` | Visible modules are rendered as “Coming soon” stubs; missing data is frequently represented by zero/null fallback cards | Replace stubs with audit-backed pages or truthful unavailable states; add shared explanation/narrative/evidence/recommendation components | dashboard E2E |

## Dashboard feature inventory

| Page route | Intended purpose | Data source / agent | Database fields | API endpoint | Current failure | Missing implementation | Tenant risk | Test |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | Executive overview | latest completed audit, report agents | `Audit`, `AuditScore`, `AIVisibilityScore`, `Issue` | `/api/audits`, `/api/audit/[id]` | overview fallbacks use null/zero and latest audit is not guaranteed complete-context | truthful summary and last-audit state | list is scoped; detail must be scope-safe | overview retrieval |
| `/dashboard/overview` | AI Visibility Overview | AI visibility, entity, retrieval, citation, semantic-trust agents | `AIVisibilityScore`, related result tables | `/api/audit/[id]/ai-visibility` | catch-all stub | real latest-audit module view | route inherits unscoped module APIs | overview E2E |
| `/dashboard/intelligence-center` | Intelligence Report / index | reporting, SII, V4 | `Report`, `SIIScore`, `V4IntelligenceScore` | `/api/audit/[id]/report`, `/api/audit/[id]/intelligence` | separate surfaces have inconsistent contracts | consolidate persisted report context and fallback prose | scope all report lookups | report integration |
| `/dashboard/health` | SiteNexis Health | crawl, score, self-audit | `AuditScore`, `SelfAuditRun`, dimension runs | `/api/self-audit/latest`, `/api/audit/[id]` | can show health without current audit evidence | link health to audit and mark no-data honestly | self-audit domain queries need user policy | health test |
| `/dashboard/ai-visibility` | site/page AI visibility | citation, entity, retrieval, semantic trust | `AIVisibilityScore`, `Page.aiScore` | `/api/audit/[id]/ai-visibility` | API exists; dashboard mapping must reject missing result as zero | shared result state and evidence | scope route query | module test |
| `/dashboard/entity` | entity intelligence | entity agent, perception graph | `Entity`, `EntityRelationship`, graph snapshot | `/api/audit/[id]/entities`, `/api/audit/[id]/perception-graph` | may render empty graph as success | entity evidence, ambiguity, sameAs, relationships | entity queries only audit-scoped | entity test |
| `/dashboard/retrieval` | retrieval optimization | retrieval agent/simulation | `RetrievalSimulation`, `PageChunk` | `/api/audit/[id]/retrieval` | no-data and failed simulation indistinguishable | status-aware passage evidence and suggestions | scope route query | retrieval test |
| `/dashboard/citation` | citation readiness estimate | citation agent | `AIVisibilityScore.breakdown`, page citation fields | `/api/audit/[id]/citation` | readiness can be presented as guaranteed probability | label estimate, factors, confidence | scope route query | citation test |
| `/dashboard/semantic-trust` | machine trust signals | semantic-trust and machine-trust agents | `MachineTrustScore`, semantic breakdown | `/api/audit/[id]/machine-trust`, `/api/audit/[id]/authenticity` | fallback scores can hide unavailable analysis | explicit confidence and evidence | scope route query | trust test |
| `/dashboard/scout` | opportunity discovery | scout agent, internal crawl, optional SERP adapter | `ScoutAnalysis`, crawl pages | `/api/audit/[id]/scout` | provider dependency can block the feature | internal-first mode and truthful SERP unavailable state | scope/cache keys | scout test |
| `/dashboard/information-gain` | content gap / information gain | information-gain agent, optional SERP adapter | `InformationGainResult` | `/api/audit/[id]/information-gain` | entire feature may depend on SERP key | internal mode, adapter, quota/cache metadata | scope/cache keys | IGE test |
| `/dashboard/links` | internal link graph | crawl agent and graph extraction | `Page.internalLinksOut`, page metrics | `/api/audit/[id]/links` | graph generation/rendering is not guaranteed | canonical link records, table fallback | scope route query | graph construction |
| `/dashboard/competitive` | supported public competitor comparison | competitive adapter and audit data | competitive v4 tables / no private competitor data | currently mixed v4 APIs | form/job/result path is incomplete | validated domains, persisted comparison job and unavailable signals | competitor cache isolation | competitor integration |
| `/dashboard/schema` | schema detection and generation | schema agent, crawled JSON-LD | `Page.schemaData`, score breakdown | `/api/audit/[id]/schema` | no-page audits can say all schema detected | page-backed detection and justified generation | scope route query | schema detection |
| `/dashboard/roadmap` | prioritized recommendations | recommendation mapping / fix-plan agents | `Issue`, recommendation tables/JSON | `/api/audit/[id]/fix-plan`, `/api/audit/[id]/fix/[issueId]` | duplicates and lifecycle are inconsistent | dedupe, priority, open/in_progress/applied/dismissed/verified | issue must be audit + user scoped | roadmap test |
| `/dashboard/monitoring` | score history | score snapshots, completed audits | `AuditScore`, V4 score, `ScoreDelta` | `/api/monitoring` | one audit can be rendered as a trend | require at least two points and explain baseline | domain queries require user scope | history test |
| `/dashboard/audits/live` | truthful audit progress | durable agent manifest and SSE | currently only `Audit.status` | `/api/audit/[id]/stream`, `/sse` | 0/15 can coexist with “complete” | agent lifecycle, counts, duration, retry | stream auth must scope audit | live E2E |
| `/dashboard/audits/history` | audit comparison/history | completed audit list and score deltas | `Audit`, scores, `ScoreDelta` | `/api/audits`, `/api/monitoring` | history and deltas are domain-scoped in places | user-scoped history and no one-point trend | cross-user domain leakage risk | history isolation |
| `/dashboard/reports` | readable executive/intelligence report | reporting agent + Groq summary | `Report`, report JSON and audit context | `/api/audit/[id]/executive-summary`, `/report`, `/narrative-report` | raw provider failures and incomplete context can leak | deterministic safe fallback prose | scope report route | report fallback |
| `/dashboard/perception-graph` | entity/topic/claim graph | perception graph agent | graph snapshot, fact nodes/edges | `/api/audit/[id]/perception-graph` | empty canvas lacks useful table fallback | evidence-backed graph and table fallback | scope route query | graph fallback |
| `/dashboard/issues` | issue inventory | all analysis agents | `Issue` | `/api/audit/[id]`, fix APIs | issue actions need consistent lifecycle | shared issue state and scoped mutations | issue ID lookup must include user | issue isolation |
| `/dashboard/query-test` | retrieval simulation query | retrieval/query simulation | simulation records | `/api/audit/[id]/query-simulate` | provider and audit context can be absent | no-data state and persisted query provenance | scope route | query test |
| `/dashboard/machine-trust` | machine trust detail | machine-trust | `MachineTrustScore` | `/api/audit/[id]/machine-trust` | duplicated semantic-trust surface | consolidate or clearly distinguish | scope route | trust module |
| `/dashboard/temporal` | freshness and authority | temporal-authority | `TemporalAuthorityRecord` | `/api/audit/[id]/temporal` | history can use unrelated domain audits | user-scoped baseline selection | cross-user domain leakage risk | temporal isolation |
| `/dashboard/surfaces` | recommendation surfaces | recommendation mapping | `RecommendationSurfaceMap` | `/api/audit/[id]/surfaces` | absent provider signals may look like zero | status + confidence + provenance | scope route | surface test |
| `/dashboard/fix-plan` | remediation plan | fix-plan and verification | issue/fix data | `/api/audit/[id]/fix-plan` | overlap with roadmap | reuse roadmap model | scope mutations | fix plan test |
| `/dashboard/authenticity` | synthetic/entity authenticity | synthetic entity agent | `SyntheticEntityFlag` | `/api/audit/[id]/authenticity` | score without evidence is misleading | evidence and no-data state | scope route | authenticity test |

## Required shared contracts and completion rules

All agents should emit a typed result envelope with `status`, optional `score`,
`summary`, `findings`, `evidence`, `affectedPages`, `severity`, `confidence`,
`recommendations`, `generatedAt`, `engineVersion`, and `failureReason`. The
allowed statuses are `pending`, `running`, `completed`, `partial`, `failed`,
`not_configured`, `not_applicable`, and `no_data`.

An audit may be `complete` only when crawl persistence succeeded and every
required agent has a terminal result (`completed`, `partial`, `not_applicable`,
or `no_data`) with its result row written. Otherwise it remains `running` or is
marked `failed` with a partial-failure manifest. A score of zero is valid only
when the agent actually measured zero; missing data must remain null and carry a
status.

