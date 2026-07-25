# Google Integrations Forensic Audit

Audit scope: repository state on 2026-07-25. This audit verifies code and repository evidence only. It does not claim that Vercel environment variables, Google Cloud consent-screen settings, GTM container configuration, or a production deployment are correct unless the repository proves them.

## Executive verdict

The Google integration subsystem exists in the current branch and has been committed in the repository history. It includes:

- conditional Google Tag Manager injection;
- a typed event layer that pushes SiteNexis events to `window.dataLayer`;
- server-side GA4 Data API synchronization;
- server-side Search Console synchronization;
- Google OAuth with both read-only scopes;
- encrypted access and refresh token storage;
- refresh-token handling;
- property/site selection;
- disconnect and status routes;
- a dashboard connector card;
- a daily sync route and deterministic insight generation.

It is not possible to prove from this checkout that the correct production secrets and Google Cloud settings are present on Vercel. Therefore the subsystem is code-complete enough for configuration and integration testing, but it is not proven fully live.

## Evidence by feature

### Google Tag Manager

- GTM ID is read at `apps/web/src/app/layout.tsx:9` from `NEXT_PUBLIC_GTM_ID`.
- The browser GTM bootstrap is injected at `apps/web/src/app/layout.tsx:291-298` using `next/script` with `afterInteractive`.
- The noscript fallback is rendered at `apps/web/src/app/layout.tsx:300-308`.
- The variable is declared in `apps/web/src/lib/env.ts:82`.
- The CSP allows Google Tag Manager and Analytics hosts in `apps/web/next.config.ts`.

Production readiness: conditionally production-ready. It will emit no GTM script when `NEXT_PUBLIC_GTM_ID` is empty. The repository does not contain the GTM container's tags, triggers, consent settings, or GA4 configuration, so those must be verified in Google Tag Manager.

### Analytics events and GA4

- Event definitions and payload types are in `apps/web/src/lib/analytics/events.ts:8-29`.
- Event dispatch is centralized in `trackEvent()` at `apps/web/src/lib/analytics/events.ts:41-47`.
- Events are pushed as `sn_<event-name>` objects into `window.dataLayer`.
- Current event names are `sn_signup`, `sn_login`, `sn_website_added`, `sn_audit_started`, `sn_audit_completed`, `sn_audit_failed`, `sn_report_viewed`, `sn_report_downloaded`, `sn_recommendation_viewed`, `sn_recommendation_applied`, `sn_integration_connected`, `sn_sync_completed`, and `sn_sync_failed`.
- Current call sites include the login/signup pages, dashboard audit flow, page-intelligence flow, and Google integration card.
- GA4 is intentionally configured inside GTM; the application does not expose or read a standalone measurement ID and does not call `gtag()` directly.
- The layout explicitly states that GA4 tags are configured inside GTM at `apps/web/src/app/layout.tsx:291`.

Conclusion: SiteNexis has a GTM-mediated analytics event layer and a server-side GA4 Data API connector. It does not have a standalone browser GA4 implementation. Page-view tracking and event-to-GA4 routing depend on the GTM container configuration, which is outside this repository.

### Search Console

- Search Console OAuth scope is declared in `apps/web/src/lib/google/oauth-client.ts:9-13`.
- Search Console site discovery is implemented in `listGscSites()` at `apps/web/src/app/api/integrations/google/properties/route.ts:59-64`.
- Search Analytics synchronization is implemented by `fetchGscMetrics()` in `apps/web/src/lib/google/gsc-sync.ts:65-91`.
- Daily, query, and page metrics are persisted by the Google integration query layer in `packages/db/src/queries/google-integrations.ts`.
- The daily sync invokes `fetchGscMetrics()` at `apps/web/src/app/api/cron/google-sync/route.ts:79-94`.
- The repository contains an HTML verification resource at `apps/web/public/google042c5579d9893788.html`.
- `apps/web/src/app/robots.ts` and `apps/web/src/app/sitemap.ts` exist and are part of the public discovery surface.

Conclusion: Search Console support is implemented through OAuth and the Search Console API. Verification is represented by an HTML verification file rather than a repository-visible meta-tag implementation. Whether the file value is registered in the intended Google Search Console property must be verified in Google.

### Google OAuth

- Client ID, secret, and redirect URI are used by `createGoogleOAuthClient()` in `apps/web/src/lib/google/oauth-client.ts:15-20`.
- Requested scopes are GA4 readonly, Search Console readonly, and user email at `apps/web/src/lib/google/oauth-client.ts:9-13`.
- The authorization URL requests offline access and consent at `apps/web/src/lib/google/oauth-client.ts:23-32`.
- The connect route is `apps/web/src/app/api/integrations/google/connect/route.ts`.
- The callback route is `apps/web/src/app/api/integrations/google/callback/route.ts`.
- OAuth state is generated and stored as a secure, HTTP-only, same-site cookie by the connect route and verified by `verifyOAuthState()` in `apps/web/src/lib/google/state.ts`.
- The callback obtains tokens and account email with `exchangeGoogleAuthCode()` and stores encrypted tokens through `upsertGoogleConnection()`.
- Tokens are encrypted with AES-256-GCM in `apps/web/src/lib/google/crypto.ts`.
- Refresh handling is implemented by `getValidAccessToken()` in `apps/web/src/lib/google/token-manager.ts:8-34` and persists the refreshed access token.
- Callback error handling covers access denial, invalid state, exchange failure, missing refresh token, and missing required scopes.

Conclusion: OAuth is implemented. It is configuration-dependent on `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and `GOOGLE_TOKEN_ENCRYPTION_KEY`.

### Dashboard integration

- The dashboard card is `apps/web/src/components/dashboard/GoogleIntegrationCard.tsx`.
- It is mounted at `apps/web/src/app/dashboard/settings/integrations/page.tsx:66`.
- Users can connect through `/api/integrations/google/connect`.
- Users can view connection status through `/api/integrations/google/status`.
- Users can list GA4 properties and verified Search Console sites through `/api/integrations/google/properties`.
- Users can save each selected property independently through the POST handler in that route.
- Users can change selected properties from the card.
- Users can disconnect through `/api/integrations/google/disconnect`.
- The Intelligence Center dashboard reads synchronized data through `/api/intelligence-center/dashboard` and renders connector state at `apps/web/src/app/dashboard/intelligence-center/page.tsx`.

Conclusion: The dashboard integration exists. It correctly distinguishes not configured, connected, pending, expired, and error states. It does not expose Google Cloud OAuth configuration or GTM container configuration because those are administrator deployment concerns.

## Environment variables

| Variable | Purpose | Referenced | Required for feature | Repository evidence |
|---|---|---:|---:|---|
| `NEXT_PUBLIC_GTM_ID` | Browser GTM container ID | Yes | Yes for GTM | `layout.tsx:9`, `layout.tsx:292` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Yes | Yes for OAuth | `oauth-client.ts:17` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Yes | Yes for OAuth | `oauth-client.ts:18` |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth callback URI | Yes | Yes for OAuth | `oauth-client.ts:19` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | AES-256-GCM token encryption key | Yes | Yes for token persistence | `crypto.ts:getKey()` |
| `CRON_SECRET` | Authorizes the daily sync route | Yes | Yes for scheduled synchronization | `cron/google-sync/route.ts` |

The repository does not provide the actual production values, and they must not be committed.

## Deployment and branch audit

- Current branch: `master`.
- Current HEAD: `93a576b`, tracking `origin/master`.
- The Google integration history is present in the current branch. Relevant commits include `0815184` (Intelligence Center foundation), `e3ad40c` (GA4 + Search Console sync and dashboard), `948adea` (scope verification), `03f44f8` (property selection preservation), and `e2221ae` (removal of temporary diagnostic logging).
- The working tree is not clean; there are uncommitted changes from the current foundation and Citation Intelligence work. Those changes have not been pushed or deployed by this audit.
- The checkout contains no Vercel deployment record or production environment snapshot. Git history alone cannot prove that the current Vercel deployment has the required secrets, Google Cloud redirect URI, consent-screen scopes, GTM container settings, or cron schedule.

## Gap matrix

| Feature | Code Exists | Config Missing or unproven | Fully Live |
|---|---:|---:|---:|
| GTM | Yes | `NEXT_PUBLIC_GTM_ID` and GTM container settings unproven | No repository evidence |
| GA4 browser tracking | Partial: events route to GTM; direct measurement ID unused | GTM GA4 tag, trigger, consent and page-view settings unproven | No repository evidence |
| GA4 Data API sync | Yes | OAuth credentials, property selection and cron unproven | No repository evidence |
| Search Console | Yes | OAuth credentials, verified property and cron unproven | No repository evidence |
| Google OAuth | Yes | Google Cloud app, redirect URI, consent screen and secrets unproven | No repository evidence |
| Analytics events | Yes | GTM routing and production event validation unproven | No repository evidence |
| Dashboard integration | Yes | Production configuration unproven | No repository evidence |

## Honest completion estimate

For source-code capability, the subsystem is approximately 85% complete. The remaining 15% is mostly deployment and external-console verification, plus browser analytics validation. This is not a claim that 85% of production launch is complete: without the Vercel and Google configuration checks, production readiness is unverified.

## Exact launch verification steps

1. In Google Cloud, enable Google Analytics Admin/Data APIs and Search Console API.
2. Configure the OAuth consent screen, add the required scopes, and publish or authorize the intended test users.
3. Set the exact Vercel redirect URI to the deployed callback URL: `/api/integrations/google/callback`.
4. Set the four OAuth/token secrets and `CRON_SECRET` in the Vercel environment used by the deployment.
5. Set `NEXT_PUBLIC_GTM_ID` in the Vercel environment and verify the GTM container has GA4 configuration, page-view tracking, consent behavior, and custom-event mappings for all `sn_*` events.
6. Verify the Search Console HTML file or replace it with the verification method registered for the production property.
7. Connect a real Google account in the deployed dashboard, select both properties, run the properties endpoint, and verify no token or secret appears in responses or logs.
8. Invoke the cron route with the configured authorization and confirm GA4/GSC sync rows and sync logs are written.
9. Check the Intelligence Center dashboard with real data and test expired-token refresh, disconnect, insufficient scopes, and provider failures.
10. Use Google Tag Assistant and GA4 DebugView to verify page views and each custom event. The repository cannot perform this external-console verification.

## Citation Intelligence provider meaning

The current Citation Intelligence implementation measures first-party evidence found while crawling the audited site: internal citations, outbound references, structured `sameAs`, and categorized source references. It does not claim that those observations are the complete backlink or mention profile.

The free core does not require these adapters. They are optional future enhancements:

- backlink provider: an optional licensed backlink/index API or customer-authorized source;
- mention provider: a compliant web/news/social search source, with deduplication and canonicalization;
- AI citation monitoring: a controlled prompt-observation system using permitted provider APIs or approved browser workflows, storing model, prompt, date, locale, cited URLs, and evidence excerpts;
- normalization: source URL, target URL, observed time, source category, status, confidence, provenance, and tenant-scoped cache key;
- governance: provider terms, quota tracking, rate limits, deletion controls, and an explicit distinction between “not observed” and “does not exist.”

The implementation should add these providers behind interfaces and keep internal mode fully usable when no provider is configured. No score should treat an unavailable provider as zero authority.
