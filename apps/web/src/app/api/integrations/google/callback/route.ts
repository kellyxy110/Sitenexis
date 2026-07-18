export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { encryptToken } from '@/lib/google/crypto';
import { exchangeGoogleAuthCode } from '@/lib/google/oauth-client';
import { verifyOAuthState, GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/google/state';

const INTEGRATIONS_PAGE = '/dashboard/settings/integrations';

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
    const { upsertGoogleConnection } = await import('@sitenexis/db');
    await upsertGoogleConnection({
      userId: user.id,
      googleAccountEmail: tokens.googleAccountEmail,
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken),
      scopes: tokens.scopes,
      tokenExpiresAt: tokens.expiresAt,
    });

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
