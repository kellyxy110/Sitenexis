# SiteNexis Intelligence Report v2

## Product contract

Intelligence Report v2 is the evidence-backed synthesis layer for SiteNexis. It explains what happened, why it matters, what evidence supports it, what remains unknown, and what should happen next. It does not replace the crawler, score engines, intelligence modules, MRS, Fix Plan, Decision Roadmap, or existing report endpoints.

## Report views

- Executive: score, grade, confidence, coverage, business category, commercial-risk context, strongest and weakest areas, top actions.
- Strategic: category analysis, authority, content, local, entity, citation, and implementation implications.
- Evidence: source layer, values, URLs, timestamps, confidence, conflicts, and related root causes.

The default view stays simple. Mobile defaults to summary cards and expandable evidence instead of large forensic tables.

## Audit Coverage and Report Confidence

Coverage is proposed as a transparent measure of examined scope: URL discovery, attempted URLs, successful crawls, rendered validations, failed/excluded URLs, external sources checked, and provider availability. It is not a health score.

Report Confidence is proposed as a separate measure based on crawl completeness, source consistency, raw/rendered agreement, provider availability, contradiction count, evidence quality, and historical comparability. It does not convert unknown data into negative findings.

## Worker/serverless parity contract

| Signal | Worker | Serverless | Fallback | Confidence effect |
| --- | --- | --- | --- | --- |
| Crawl pages | rendered Puppeteer | fetch-first | Crawl4AI if configured | coverage reflects mode/cap |
| Robots/sitemap | crawler | adapters/serverless crawl | retry where available | timeout is temporary failure |
| headings/content/schema | rendered DOM | static, then CSR retry | rendered retry | disagreement is conflicting/partial |
| analysis agents | full graph | partial/internal equivalents | non-fatal partial state | report states availability |
| PDF | reporting agent | not identical | preserve existing v1 behavior | no v2 PDF claim until parity |

## Protected contracts

The following are immutable until a later explicit compatibility review: `POST /api/audit/start`; existing audit retrieval routes and IDs; Supabase ownership checks; middleware; billing, credits, and Layer 4 gating; `AuditScore.breakdown` consumers; CSV/PDF exports; BullMQ queue and worker; serverless fallback behavior.

## Delivery rules

V1 is default. V2 is opt-in for selected new audits. Existing audits remain readable as v1. V2 generation is asynchronous and non-blocking. Any comparison across methodology versions displays a comparability warning. No deployment or flag-system introduction is part of this documentation phase.
