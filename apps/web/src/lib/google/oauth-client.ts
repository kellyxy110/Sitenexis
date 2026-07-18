/**
 * Google OAuth2 client for the AI Visibility Intelligence Center.
 * One consent flow covers both GA4 (analytics.readonly) and Search Console
 * (webmasters.readonly) — the user picks both properties after a single connect.
 */
import { google } from 'googleapis';
import { env } from '@/lib/env';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

/** Build the URL to redirect the user to for Google's consent screen. `state` is a CSRF nonce only — never carries identity. */
export function buildGoogleAuthUrl(state: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent',      // force a fresh refresh_token even on re-connect
    scope: [...GOOGLE_OAUTH_SCOPES],
    state,
  });
}

export interface GoogleTokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  googleAccountEmail: string;
}

/** Exchange an OAuth `code` for tokens, and fetch the connected account's email. */
export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenExchangeResult> {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) throw new Error('Google did not return an access token.');
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. This usually means the account already granted consent — ' +
      'revoke access at https://myaccount.google.com/permissions and reconnect.',
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: 'v2' });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new Error('Google did not return an account email.');

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
    scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
    googleAccountEmail: data.email,
  };
}

export interface GoogleRefreshResult {
  accessToken: string;
  expiresAt: Date;
}

/** Exchange a stored refresh token for a fresh access token. */
export async function refreshGoogleAccessTokenViaApi(refreshToken: string): Promise<GoogleRefreshResult> {
  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Google did not return a refreshed access token.');
  return {
    accessToken: credentials.access_token,
    expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3_600_000),
  };
}

/** Build an authenticated OAuth2 client from a plaintext access token, for making a single API call. */
export function clientWithAccessToken(accessToken: string) {
  const client = createGoogleOAuthClient();
  client.setCredentials({ access_token: accessToken });
  return client;
}
