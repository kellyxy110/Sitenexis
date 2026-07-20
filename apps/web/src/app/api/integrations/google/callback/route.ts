export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { encryptToken } from '@/lib/google/crypto';
import { exchangeGoogleAuthCode, GOOGLE_OAUTH_SCOPES } from '@/lib/google/oauth-client';
import { verifyOAuthState, GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/google/state';

const INTEGRATIONS_PAGE = '/dashboard/settings/integrations';

// The two scopes without which the integration cannot do anything useful.
// userinfo.email/openid are excluded — Google grants those unconditionally.
const REQUIRED_SCOPES = GOOGLE_OAUTH_SCOPES.filter((s) => s !== 'https://www.googleapis.com/auth/userinfo.email');

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { origin, searchParams } = new URL(req.url);
  const redirectTo = (path: string) => NextResponse.redirect(`${origin}${path}`);

  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  // Google redirects here with ?error=access_denied if the user cancels consent.
  const googleError = searchParams.get('error');
  if (googleError) {
    return redirectTo(`${INTEGRATIONS_PAGE}?google_error=${encodeURIComponent(googleError)}`);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const stateCookie = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !verifyOAuthState(stateCookie, state)) {
    logger.warn({ userId: user.id, hasCode: Boolean(code) }, 'Google OAuth callback failed state verification');
    return redirectTo(`${INTEGRATIONS_PAGE}?google_error=invalid_state`);
  }

  try {
    const tokens = await exchangeGoogleAuthCode(code);
    const { upsertGoogleConnection, setGoogleConnectionError } = await import('@sitenexis/db');
    await upsertGoogleConnection({
      userId: user.id,
      googleAccountEmail: tokens.googleAccountEmail,
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken),
      scopes: tokens.scopes,
      tokenExpiresAt: tokens.expiresAt,
    });

    // Google can silently grant a reduced scope set (most commonly when the
    // OAuth consent screen's configured Scopes list, or its Testing-mode
    // sensitive-scope warning, doesn't line up with what was requested) —
    // the token exchange itself still "succeeds" in that case, so this is the
    // one place that actually verifies GA4/Search Console access was granted,
    // not just that *a* Google account was authenticated.
    const missingScopes = REQUIRED_SCOPES.filter((s) => !tokens.scopes.includes(s));
    if (missingScopes.length > 0) {
      logger.warn(
        { userId: user.id, granted: tokens.scopes, missing: missingScopes },
        'Google OAuth succeeded but did not grant the required Analytics/Search Console scopes',
      );
      await setGoogleConnectionError(
        user.id,
        'error',
        `Google did not grant access to: ${missingScopes.join(', ')}. Only basic profile access was authorized.`,
      );
      const res = redirectTo(`${INTEGRATIONS_PAGE}?google_error=insufficient_scopes`);
      res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
      return res;
    }

    const res = redirectTo(`${INTEGRATIONS_PAGE}?connected=google`);
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    logger.error({ userId: user.id, err: err instanceof Error ? err.message : String(err) }, 'Google OAuth token exchange failed');
    const res = redirectTo(`${INTEGRATIONS_PAGE}?google_error=exchange_failed`);
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return res;
  }
}
