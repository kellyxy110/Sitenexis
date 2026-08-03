# SiteNexis Ops — Operational Intelligence + Audit Intelligence

Status: Implemented. Alerting disabled by default in production (`TELEGRAM_ALERTS_ENABLED=false`) until explicitly enabled. Audit Intelligence commands (`/audit`, `/scores`, `/issues`, `/recommendations`, `/evidence`, `/report`) are read-only and always active for the admin chat.

## What this is

SiteNexis Ops has two layers under one Telegram bot:

- **Operations Intelligence** (original, v1) — watches SiteNexis's own audit pipeline, worker health, provider availability, and deployments, and raises alerts to a private Telegram channel when something needs attention.
- **Audit Intelligence** (this addition) — a read-only, Telegram-native presentation layer over the *existing* canonical audit, scoring, evidence, and Intelligence Report systems, so an authorized admin can pull a real analytical report for any audited domain (`/audit truvyx.org`) directly from Telegram.

Neither layer is a customer-facing chatbot, and neither independently produces scores — see [Scope boundary](#scope-boundary) below.

## Architecture

```
Alert source (audit runner, health check, deploy webhook, ops-monitor cron)
  → OperationalEvent
    → routing policy (severity + should-notify + dedupe window)
      → dedupe check (Redis, atomic SET NX EX)
        → Telegram provider (send message)
```

All of this lives under `apps/web/src/lib/telegram-ops/`:

| File | Responsibility |
|---|---|
| `types.ts` | The `OperationalEvent` vocabulary — 7 event types, 3 severities. Pure types, no I/O. |
| `routing-policy.ts` | A static table mapping each event type to a severity, a notify flag, and a dedupe window. Pure function, no I/O. |
| `dedup.ts` | Redis-backed atomic dedupe (`SET key val EX <window> NX`). Fails open — a Redis outage never suppresses a real alert, it just allows duplicates through. |
| `telegram-provider.ts` | Thin Telegram Bot API client: send a message, check the admin-chat allowlist, verify the webhook secret (timing-safe). The bot token is never logged or included in any response. |
| `orchestrator.ts` | `notifyOps(event)` — the single entry point every alert source calls. Wraps the whole pipeline in try/catch; a Telegram outage, a Redis outage, or a malformed event can never propagate back to the caller. |
| `commands.ts` | The six Operations command handlers (below), plus `escapeHtml`/`fmtTime`/`runCommand` shared with `audit-commands.ts`. |
| `audit-commands.ts` | The six Audit Intelligence command handlers — calls into `apps/web/src/lib/audit-intelligence/`, never computes a score itself. |
| `digest.ts` | Builds the daily operational digest message. |
| `deployment-log.ts` | A capped Redis list of recent deployment events, backing the `/deployments` command (there is no Postgres table for this — see [Known limitations](#known-limitations)). |

Audit Intelligence's own service layer lives under `apps/web/src/lib/audit-intelligence/` — see [How Audit Intelligence stays consistent with the dashboard](#how-audit-intelligence-stays-consistent-with-the-dashboard).

## Operational event types

| Event | Severity | Dedupe window | Emitted from |
|---|---|---|---|
| `AUDIT_FAILED` | critical | 5 min | `serverless-audit.ts` — homepage crawl failure, unhandled error |
| `AUDIT_PARTIAL` | warning | 15 min | `serverless-audit.ts` — processing budget reached, Layer 4 incomplete |
| `AUDIT_STALLED` | warning | 15 min | `ops-monitor` cron — audit stuck in `running` with no update |
| `PROVIDER_DEGRADED` | warning | 30 min | Defined in the routing policy; **not yet wired to an emitter** — no code path raises this event today |
| `WORKER_HEALTH_DEGRADED` | critical | 30 min | `ops-monitor` cron — worker heartbeat check failing |
| `DEPLOYMENT_READY` | info | 1 min | `webhooks/vercel-deploy` route |
| `DEPLOYMENT_ERROR` | critical | 1 min | `webhooks/vercel-deploy` route |

Severity, notify decision, and dedupe window are a single static table (`routing-policy.ts`) — there is no per-call override. Changing alert behavior for an event type means changing that one table.

## Commands

All commands are read-only — none of them mutate audit data, trigger a re-run, or touch billing/credits/auth. Access control is a single-identity allowlist: only the chat ID in `TELEGRAM_ADMIN_CHAT_ID` (a numeric Telegram chat ID, never a phone number) receives responses; every other chat is silently ignored.

**Operations**

| Command | Reports |
|---|---|
| `/status` | Database, Redis, BullMQ queue, and worker-heartbeat health — the same checks behind `/api/health` |
| `/audits` | The 10 most recently created audits (any user, excluding demo audits) and their status |
| `/failures` | Audits that failed, went partial, or stalled in the last 24 hours |
| `/providers` | Which analyzer providers were unavailable across the last 20 audits, and why |
| `/incidents` | `/failures` plus current worker health, combined into one view |
| `/deployments` | The last 5 recorded deployment events |

**Audit Intelligence** — `<domain>` accepts a bare domain, or a full URL (protocol/path/`www.` are normalized). Looks up the latest usable audit for that domain across all users (mirroring the Operations commands' cross-user visibility), preferring a `complete` audit and falling back to `partial` only when no completed audit exists.

| Command | Reports |
|---|---|
| `/audit <domain>` | Executive intelligence summary: canonical scores, the same AI-generated executive assessment shown on the dashboard, top findings, and the single highest-priority action |
| `/scores <domain>` | Every canonical score tier that exists for the audit (V1 Technical SEO, V2 AI Visibility, Layer 4 Machine Trust, SII) |
| `/issues <domain>` | Deduplicated issues grouped by canonical severity (`critical` / `warning` / `info` — SiteNexis has no "high/medium/low" tier) |
| `/recommendations <domain>` | The canonical Fix Plan, grouped by P0/P1/P2 |
| `/evidence <domain>` | Crawl, indexability, schema, and entity evidence for the audit's homepage and site-wide aggregates |
| `/report <domain>` | An executive excerpt of the canonical Narrative Report, chunked for Telegram, with a link to the full report |

### How Audit Intelligence stays consistent with the dashboard

This is the one non-negotiable architectural constraint of this layer: **Telegram must never independently calculate a score, and the same audit must never show different numbers on Telegram than on the dashboard.**

- `/scores`, `/issues`, `/recommendations`, and `/evidence` are pure reads of already-computed canonical data (`audit_scores`, `ai_visibility_scores`, `machine_trust_scores`, the `issues` table) plus the same pure scoring/dedupe/fix-plan functions the dashboard uses (`dedupeFindings`, `buildFixPlan`). No AI call is made for any of these four commands.
- `/audit` and `/report` are the only two commands that involve prose generation, and both read/write the **exact same Redis cache key** (`exec-summary:{auditId}:v1.0` and `narrative:{auditId}:v4.1` respectively) as `/api/audit/[id]/executive-summary` and `/api/audit/[id]/narrative-report`. A cache hit is byte-identical to what the dashboard shows; a cache miss calls the identical canonical prompt through the identical model router — never a second, independent LLM call with different context.
- This logic lives in `apps/web/src/lib/audit-intelligence/` (`domain-lookup.ts`, `report-context.ts`, `executive-summary-service.ts`, `narrative-report-service.ts`, `scorecard.ts`, `issues.ts`, `recommendations.ts`, `evidence.ts`) and is called from `apps/web/src/lib/telegram-ops/audit-commands.ts`. The context-assembly logic in `report-context.ts` intentionally mirrors (rather than imports from) the two dashboard routes, to avoid touching two already-tested production routes in this increment — a future refactor could have both routes call the shared function instead.
- `/runaudit` (triggering a new audit from Telegram) is explicitly **not implemented**. This layer is read-only.

## Provider fallback philosophy

`/providers` and `/incidents` exist to make one distinction visible at a glance: **a provider being unavailable is not the same thing as an audit failing.** When a provider is unconfigured or errors, the affected agent reports `not_configured` / `no_data` / `failed` for that specific module and the audit continues — it does not fail the audit, and it does not silently produce a fabricated result. This mirrors the same principle enforced in the scoring layer (see [`scoring-methodology-v2.md`](scoring-methodology-v2.md) and [`root-cause-penalty-model.md`](root-cause-penalty-model.md)): unavailable measurement is excluded from scoring, never converted into a penalizing zero.

## Alert delivery guarantees

- `notifyOps()` never throws and never blocks the operation it's observing — every call site invokes it as `void notifyOps(...)` from a non-blocking position.
- A Telegram API failure, a Redis outage, or a malformed event is logged and swallowed inside the orchestrator. It cannot fail an audit, a deployment webhook, or a cron run.
- Duplicate alerts for the same underlying condition are suppressed for that event type's dedupe window, so a stuck audit or a flapping provider doesn't spam the channel.

## Environment variables

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot API credential. Server-side only, read at the point of use, never logged. |
| `TELEGRAM_ADMIN_CHAT_ID` | The single numeric chat ID authorized to receive alerts and issue commands. |
| `TELEGRAM_WEBHOOK_SECRET` | Verified against Telegram's `X-Telegram-Bot-Api-Secret-Token` header (timing-safe comparison) on every webhook request. |
| `TELEGRAM_ALERTS_ENABLED` | Master switch. Defaults to `false` — every alert path and the webhook route no-op until this is explicitly `true`. |

None of these are committed to source control; see the root `.gitignore` `.env*` rules.

## Routes

| Route | Trigger | Auth |
|---|---|---|
| `POST /api/telegram/webhook` | Telegram, on every message sent to the bot | `X-Telegram-Bot-Api-Secret-Token` header match |
| `GET /api/cron/ops-digest` | Vercel Cron, daily 07:00 UTC | `Authorization: Bearer <CRON_SECRET>` |
| `GET /api/cron/ops-monitor` | Vercel Cron, every 10 minutes | `Authorization: Bearer <CRON_SECRET>` |

## Scope boundary

**Operations Intelligence** (`/status`, `/audits`, `/failures`, `/providers`, `/incidents`, `/deployments`) is operational infrastructure, not a scoring input. It does not read from, write to, or influence the 25-category scoring model, the root-cause/evidence model, or Intelligence Report V2 — it only reports pipeline/infrastructure health. Symmetrically: a SiteNexis platform incident (a Redis outage, a stalled worker, a Telegram delivery failure) is never itself evidence that an audited website has a problem. The two systems are deliberately kept independent.

**Audit Intelligence** (`/audit`, `/scores`, `/issues`, `/recommendations`, `/evidence`, `/report`) *does* read an audit's stored results — that is its purpose — but only reads. It never writes to an audit record, never triggers a new audit, and never computes a score, severity, or priority independently of the canonical scoring/analyzer modules documented in `scoring-methodology-v2.md`, `evidence-model.md`, and `intelligence-report-v2.md`. It is a presentation adapter over those systems, not a second implementation of them.

## Known limitations

- `PROVIDER_DEGRADED` is defined in the routing policy but no code path emits it yet — module-level provider unavailability is currently only visible through `/providers`'s point-in-time query, not a push alert.
- Deployment history (`/deployments`, `deployment-log.ts`) is a capped Redis list, not a persisted table — it holds only the last 10 events and does not survive a Redis flush.
- The daily digest and ops-monitor cron have not yet been exercised against live production traffic; correctness has been verified by unit tests with all Telegram/Redis calls mocked, not by an end-to-end production run.
- Audit Intelligence's domain lookup is cross-user, matching the existing Operations-command precedent — `/audit truvyx.org` returns the latest usable audit for that domain regardless of which account created it. There is exactly one authorized admin chat, so this is the same trust boundary the Operations commands already rely on, not a new one.
- `/report`'s section rendering defensively probes a couple of plausible field-name shapes (`summary`/`overview`, `name`/`title`, `narrative`/`content`) in the canonical Narrative Report's JSON, since that JSON is AI-generated per a prompt rather than a fixed schema. If the model's output uses different field names than expected, `/report` degrades to just the section headers with no body text — it does not fabricate content.
- `/runaudit` (triggering a new audit from Telegram) is not implemented in this increment — deliberately out of scope pending a separate security review of authorization, billing, and abuse protection for a write-capable Telegram command.
