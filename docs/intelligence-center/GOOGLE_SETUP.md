# Google Cloud Setup — AI Visibility Intelligence Center

Steps required before any user can connect GA4 or Search Console. This is a
one-time setup per environment (do it once for production, once for any preview/
staging environment that needs real Google data).

## 1. Create or reuse the OAuth client

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → select or
   create a project (e.g. "SiteNexis").
2. **APIs & Services → Library** — enable all three:
   - **Google Analytics Data API** (this is the GA4 reporting API — not "Google Analytics API",
     which is the legacy Universal Analytics one)
   - **Google Analytics Admin API** (a *separate* API from the Data API above — required
     for listing which GA4 properties the connected account has access to; the code
     calls this via `google.analyticsadmin(...).accountSummaries.list()`. Skipping this
     one produces an "Insufficient Permission" error even when the Data API is enabled.)
   - **Google Search Console API**
3. **APIs & Services → OAuth consent screen**
   - User type: **External** (unless the whole org is on one Google Workspace)
   - App name: `SiteNexis`
   - **Scopes** step — this is a separate registration step from what the code requests
     at runtime. A scope Google's authorization server hasn't seen added here can be
     silently dropped from any grant, even if the code asks for it and the user clicks
     Allow. Add both:
     - `https://www.googleapis.com/auth/analytics.readonly`
     - `https://www.googleapis.com/auth/webmasters.readonly`
   - While the app is in "Testing" mode, only test users you explicitly add can
     complete the OAuth flow — add your own Google account here first, or publish
     the app (requires Google verification for these scopes since they're
     sensitive — budget a few days for review if going fully public).
   - After connecting, verify at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
     that SiteNexis appears under **apps with access to your data**, not only under
     **Sign in with Google**. If it only shows under "Sign in with Google", the
     consent only granted basic profile access — remove it there and reconnect,
     watching for explicit Analytics/Search Console permission lines on the consent
     screen this time. SiteNexis now checks this itself (see `oauth-client.ts` /
     `callback/route.ts`) and will show a clear in-app error instead of silently
     treating a profile-only grant as a working connection.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Sitenexis Web`
   - Authorized redirect URIs — add **exactly**:
     - Production: `https://sitenexis.com/api/integrations/google/callback`
     - Local dev: `http://localhost:3000/api/integrations/google/callback`
   - Save. Copy the **Client ID** and **Client Secret** — these map to
     `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## 2. Environment variables

Add to Vercel (Project Settings → Environment Variables) for every environment
that needs real Google data, and to your local `.env`:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | From step 1 |
| `GOOGLE_CLIENT_SECRET` | From step 1 — never commit, never log |
| `GOOGLE_OAUTH_REDIRECT_URI` | Must exactly match a URI registered in step 1 |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32-byte hex key — generate with `openssl rand -hex 32` |
| `CRON_SECRET` | Any random string — generate with `openssl rand -hex 32`; Vercel Cron sends this back as a bearer token, the sync route rejects any request without a match |

`GOOGLE_TOKEN_ENCRYPTION_KEY` encrypts stored OAuth tokens at rest (AES-256-GCM).
**Rotating this key invalidates every stored connection** — users would need to
reconnect. Treat it like a database credential, not a feature flag.

None of these are `NEXT_PUBLIC_*` — all four are server-only.

Two more `NEXT_PUBLIC_*` variables are unrelated to OAuth but needed for the
GTM/GA4 tag itself to fire in the browser:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_GTM_ID` | Your GTM container ID, e.g. `GTM-XXXXXXX` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Your GA4 measurement ID, e.g. `G-XXXXXXXXXX` (configured as a tag inside GTM, not read directly by app code today — kept as an env var for any future direct-gtag fallback) |

## 3. Turbo build env passthrough

If you add or rename any of the variables above, they must also be listed in
`turbo.json` under the `build` task's `env` array, or Vercel's build step will
silently strip them even though they're set in the dashboard. This bit us
repeatedly during this build — always verify with a real deploy, not just a
local `pnpm build`, after touching this list.

## 4. Verify the connection end-to-end

1. Log in to SiteNexis, go to **Settings → Integrations**.
2. Click **Connect Google** — should redirect to Google's real consent screen
   (not an error page) listing the two scopes above.
3. Approve — should land back on `/dashboard/settings/integrations` with a
   connected state and a property picker.
4. Select a GA4 property and a Search Console site, save.
5. Wait for the next cron tick (or trigger manually — see below) and confirm
   `/dashboard/intelligence-center` shows real numbers, not empty states.

### Manually triggering a sync (for testing, without waiting for cron)

```bash
curl -X GET "https://sitenexis.com/api/cron/google-sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Only works with the real `CRON_SECRET` value — this is intentional; the route
is not meant to be publicly triggerable.

## 5. Known limitations to expect

- The OAuth consent screen must stay in "Testing" mode with explicit test users
  added, or be submitted for Google's sensitive-scope verification, before any
  user outside the test-user list can connect. This is a Google-side process,
  not something SiteNexis code controls.
- If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are unset, the Connect Google
  button still renders but the connect route returns a clear `not_configured`
  error rather than crashing — this is deliberate so the rest of the dashboard
  keeps working before Google credentials exist for an environment.
- Revoking access from the Google Account permissions page (myaccount.google.com)
  does not immediately update SiteNexis's stored connection state — the next
  sync attempt will fail and flip the connector to `permission_expired`.
