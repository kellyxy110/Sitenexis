/** Returns a valid, decrypted Google access token for a user — refreshing it first if expired. Used by every GA4/GSC-calling route. */
import { getGoogleConnectionWithTokens, refreshGoogleAccessToken as persistRefreshedToken, setGoogleConnectionError } from '@sitenexis/db';
import { encryptToken, decryptToken } from './crypto';
import { refreshGoogleAccessTokenViaApi } from './oauth-client';

const EXPIRY_SKEW_MS = 60_000; // refresh 1 minute before actual expiry

export class GoogleTokenError extends Error {}

export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await getGoogleConnectionWithTokens(userId);
  if (!connection) throw new GoogleTokenError('No Google connection for this user.');

  const isExpired = connection.tokenExpiresAt.getTime() - EXPIRY_SKEW_MS < Date.now();
  if (!isExpired) {
    return decryptToken(connection.accessTokenEncrypted);
  }

  try {
    const refreshToken = decryptToken(connection.refreshTokenEncrypted);
    const refreshed = await refreshGoogleAccessTokenViaApi(refreshToken);
    await persistRefreshedToken(userId, {
      accessTokenEncrypted: encryptToken(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    });
    return refreshed.accessToken;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token refresh failed';
    await setGoogleConnectionError(userId, 'expired', message);
    throw new GoogleTokenError(`Google access token refresh failed: ${message}`);
  }
}
