/** OAuth CSRF state nonce — a double-submit cookie, not an identity carrier. Identity always comes from the real session via requireAuth(). */
import { randomBytes, timingSafeEqual } from 'crypto';

export const GOOGLE_OAUTH_STATE_COOKIE = 'sn_google_oauth_state';

export function generateOAuthState(): string {
  return randomBytes(24).toString('hex');
}

export function verifyOAuthState(cookieValue: string | undefined, paramValue: string | null): boolean {
  if (!cookieValue || !paramValue || cookieValue.length !== paramValue.length) return false;
  return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(paramValue));
}
