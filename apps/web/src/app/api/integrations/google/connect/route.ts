export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isGoogleOAuthConfigured } from '@/lib/google/crypto';
import { buildGoogleAuthUrl } from '@/lib/google/oauth-client';
import { generateOAuthState, GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/google/state';

const STATE_COOKIE_MAX_AGE_SEC = 600; // 10 minutes — long enough for the consent screen, short enough to limit replay window

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  void user; // identity comes from the session, not from state — this call just confirms the user is logged in

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Google integration is not configured yet.' },
      { status: 503 },
    );
  }

  const state = generateOAuthState();
  const res = NextResponse.redirect(buildGoogleAuthUrl(state));
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE_SEC,
    path: '/api/integrations/google',
  });
  return res;
}
