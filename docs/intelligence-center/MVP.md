# AI Visibility Intelligence Center — MVP

Connects GA4 and Google Search Console to SiteNexis so users see real traffic and
search data alongside their AI Visibility audits, with deterministic, evidence-based
insights — never a second scoring engine, never a generic analytics dashboard.

## Architecture rules (locked)

1. **SiteNexis's deterministic engines are the only source of truth for scores.**
   The LLM never calculates, estimates, or overrides a score — its job is
   interpretation, diagnosis, prioritization, and (in Page Intelligence) rewrite
   proposals. This is the same rule already load-bearing in the Agnes/Intelligence
   assistant and the executive-summary route; nothing new was invented for this feature.
2. **Tenant boundary is the existing `User` model.** There is no separate
   `Organization` table in this codebase — every table added for this feature is
   scoped directly by `userId`, and every query helper takes it as a required,
   non-optional parameter.
3. **Sync is Vercel Cron-triggered, not BullMQ-queued.** No BullMQ worker is
   deployed for this project (a known, separate gap — see the audit pipeline's
   own `/api/health` output). GA4/Search Console sync follows the same
   serverless-compatible reality the rest of the app already lives with.
4. **Page Intelligence rewrites are suggestions only.** Nothing is ever
   auto-applied to a live page. The user reviews, accepts, and publishes externally.
5. **Every Page Intelligence recommendation must trace to a real finding.**
   Enforced in code (`filterTraceableRecommendations`), not just prompted — a
   recommendation citing zero findings, or a hallucinated finding id, is discarded
   before it's ever persisted or shown to the user.

## What was built, against the original 15-point spec

| # | Requirement | Status |
|---|---|---|
| 1 | GTM installed once in the root layout | Done — replaced a stale, mismatched hardcoded `gtag.js` snippet with the real GTM container (`next/script`, `afterInteractive`) |
| 2 | Typed SiteNexis event tracker (13 events) | Done — `lib/analytics/events.ts`; `signup`/`login`/`website_added`/`audit_started`/`audit_failed` wired to real trigger points now, the rest wire in as their own features are used (report views, recommendation accept/publish, integration connect, sync complete/fail) |
| 3 | Secure Google OAuth for GA4 + Search Console | Done — single consent flow covers both, CSRF via double-submit cookie, identity always from the real session |
| 4 | Each org connects only its own account + properties | Done — one `GoogleConnection` row per user, property IDs chosen via `/api/integrations/google/properties` |
| 5 | Encrypt OAuth tokens, secrets server-side | Done — AES-256-GCM (`lib/google/crypto.ts`), ciphertext-only at rest, never returned in any API response |
| 6 | GA4 sync (users, sessions, engagement, landing pages, channels, referrals, devices, countries, key events) | Done — `lib/google/ga4-sync.ts` |
| 7 | Search Console sync (clicks, impressions, CTR, avg position, top queries/pages) | Done — `lib/google/gsc-sync.ts` |
| 8 | Normalize into traffic/acquisition/engagement/conversions/search-visibility/AI-referral | Done — 6 Prisma models (`DailyTrafficMetric`, `AcquisitionChannelMetric`, `LandingPageMetric`, `SearchVisibilityMetric`, `SearchQueryMetric`, `SearchPageMetric`) |
| 9 | Customer dashboard | Done — `/dashboard/intelligence-center`; AI Visibility Score reuses the existing audit sub-report hook rather than duplicating it |
| 10 | Deterministic insights | Done — 5 detectors, see below |
| 11 | Every insight has evidence/page/confidence/action/verification | Done — enforced by the `AiVisibilityInsight` schema shape itself |
| 12 | Clear connector states | Done — `not_connected` / `pending` / `permission_expired` / `sync_failed` / `sync_pending` / `no_data` / `connected` (two extra precision states beyond the spec's five: `pending` for OAuth-done-but-no-property-selected, and splitting "no data" into first-sync-pending vs. synced-but-empty) |
| 13 | Admin operations view | Done — `/dashboard/admin/intelligence-center`, gated to the same owner-email allowlist as the self-audit trigger |
| 14 | Strict multi-tenant isolation | Done — every route re-checks `audit.userId`/`session.userId` against the authenticated caller, not just trusting route params |
| 15 | Migrations, tests, env examples, docs | Done — this file + `GOOGLE_SETUP.md`; migrations via `prisma db push` (this repo's existing convention, no migrations-folder workflow exists here); 243+ passing tests across both new packages touched |

## The 5 deterministic insights

All in `packages/analyzers/src/ai-visibility-insights/detectors.ts`, pure functions,
independently unit-tested (including the traceability/threshold edge cases):

1. **Impressions falling on pages with unresolved audit issues** — cross-references
   a page's Search Console impression trend against that page's real `Issue` records
   from its most recent complete audit.
2. **High impressions, low CTR** — threshold-based (≥500 impressions, <2% CTR by default).
3. **Traffic without conversion** — a landing page with real sessions (≥50) and zero
   GA4 key events.
4. **AI referral traffic reaching a page** — flags when `AcquisitionChannelMetric`
   rows show sessions from a known AI referrer domain (ChatGPT, Perplexity, Claude,
   Gemini, Copilot, You.com). Site-level attribution in v1 (the top overall landing
   page is used as a proxy) — GA4 sync doesn't cross landing-page with source
   dimensions yet, documented as a known simplification, not a silent gap.
5. **Metrics improving after a recommendation was applied** — the one insight that
   spans both halves of this build: compares a page's Search Console impressions in
   the 7 days before vs. after a Page Intelligence `OptimizationSession` was accepted
   or published, using the real `recommendedAction` text as the evidence.

Insights regenerate as part of the same daily cron that runs the GA4/GSC sync — not
a separate schedule.

## Known gaps (carried forward honestly, not hidden)

- **No BullMQ worker is deployed.** This predates this feature and affects the whole
  audit pipeline, not just this one. Deferred by explicit user decision (budget).
- **AI-referral page attribution is site-level, not page-exact** (see insight #4 above).
- **"Reports downloaded" isn't tracked server-side.** Only a client-side GTM event
  exists (`report_downloaded`) — the admin view's "Reports Generated" number is a
  labeled proxy (PDF generation count), not download-click counts.
- **Cold-URL Page Intelligence is out of scope for v1** by explicit decision — it
  only operates on pages SiteNexis has already crawled and scored.

## Clean extension points (intentionally not built)

Per the original scope: Clarity, Stripe, PostHog, Vercel Analytics, forecasting,
knowledge-graph integration, and an advanced AI Copilot were explicitly excluded.
Nothing in this build blocks adding them later:
- The typed event tracker (`lib/analytics/events.ts`) is the single seam any future
  analytics provider would read from — adding a second destination means adding a
  second `trackEvent`-style consumer, not touching call sites.
- `AiVisibilityInsight.evidence` and `OptimizationSession.scoresSnapshot` are both
  `Json` columns specifically so future insight types or forecasting logic can add
  new shapes without a schema migration.
- The Groq+Hermes provider-fallback chain (`lib/ai/provider-chain.ts`) is a generic
  "try independent providers in order" utility — a future AI Copilot feature reuses
  it rather than inventing its own fallback logic.

## Setup

See `GOOGLE_SETUP.md` for the Google Cloud Console steps required before any of
this is live (OAuth app, redirect URIs, API enablement, `CRON_SECRET`).
