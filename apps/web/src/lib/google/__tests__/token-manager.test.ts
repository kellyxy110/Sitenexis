import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getGoogleConnectionWithTokens: vi.fn(),
  refreshGoogleAccessToken: vi.fn(),
  setGoogleConnectionError: vi.fn(),
  encryptToken: vi.fn(),
  decryptToken: vi.fn(),
  refreshGoogleAccessTokenViaApi: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({
  getGoogleConnectionWithTokens: h.getGoogleConnectionWithTokens,
  refreshGoogleAccessToken: h.refreshGoogleAccessToken,
  setGoogleConnectionError: h.setGoogleConnectionError,
}));
vi.mock('../crypto', () => ({
  encryptToken: h.encryptToken,
  decryptToken: h.decryptToken,
}));
vi.mock('../oauth-client', () => ({
  refreshGoogleAccessTokenViaApi: h.refreshGoogleAccessTokenViaApi,
}));

const { getValidAccessToken, GoogleTokenError } = await import('../token-manager');

const baseConnection = {
  userId: 'user-1',
  accessTokenEncrypted: 'enc-access-old',
  refreshTokenEncrypted: 'enc-refresh',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.decryptToken.mockImplementation((v: string) => `plain:${v}`);
  h.encryptToken.mockImplementation((v: string) => `enc:${v}`);
});

describe('getValidAccessToken', () => {
  it('throws GoogleTokenError when the user has no Google connection', async () => {
    h.getGoogleConnectionWithTokens.mockResolvedValue(null);

    await expect(getValidAccessToken('user-1')).rejects.toThrow(GoogleTokenError);
    await expect(getValidAccessToken('user-1')).rejects.toThrow('No Google connection for this user.');
  });

  it('returns the decrypted access token directly when it is not near expiry — no refresh call made', async () => {
    h.getGoogleConnectionWithTokens.mockResolvedValue({
      ...baseConnection,
      tokenExpiresAt: new Date(Date.now() + 60 * 60_000), // 1 hour out
    });

    const token = await getValidAccessToken('user-1');

    expect(token).toBe('plain:enc-access-old');
    expect(h.refreshGoogleAccessTokenViaApi).not.toHaveBeenCalled();
    expect(h.refreshGoogleAccessToken).not.toHaveBeenCalled();
  });

  it('treats a token inside the 60s expiry skew as expired and refreshes it', async () => {
    h.getGoogleConnectionWithTokens.mockResolvedValue({
      ...baseConnection,
      tokenExpiresAt: new Date(Date.now() + 30_000), // 30s out — inside the 60s skew
    });
    h.refreshGoogleAccessTokenViaApi.mockResolvedValue({
      accessToken: 'fresh-access-token',
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const token = await getValidAccessToken('user-1');

    expect(h.refreshGoogleAccessTokenViaApi).toHaveBeenCalledWith('plain:enc-refresh');
    expect(token).toBe('fresh-access-token');
  });

  it('refreshes an already-expired token and persists the new encrypted token + expiry', async () => {
    h.getGoogleConnectionWithTokens.mockResolvedValue({
      ...baseConnection,
      tokenExpiresAt: new Date(Date.now() - 60_000), // already expired
    });
    const expiresAt = new Date(Date.now() + 3_600_000);
    h.refreshGoogleAccessTokenViaApi.mockResolvedValue({ accessToken: 'fresh-access-token', expiresAt });

    const token = await getValidAccessToken('user-1');

    expect(token).toBe('fresh-access-token');
    expect(h.encryptToken).toHaveBeenCalledWith('fresh-access-token');
    expect(h.refreshGoogleAccessToken).toHaveBeenCalledWith('user-1', {
      accessTokenEncrypted: 'enc:fresh-access-token',
      tokenExpiresAt: expiresAt,
    });
    expect(h.setGoogleConnectionError).not.toHaveBeenCalled();
  });

  it('marks the connection as expired and re-throws GoogleTokenError when the refresh call fails', async () => {
    h.getGoogleConnectionWithTokens.mockResolvedValue({
      ...baseConnection,
      tokenExpiresAt: new Date(Date.now() - 60_000),
    });
    h.refreshGoogleAccessTokenViaApi.mockRejectedValue(new Error('invalid_grant'));

    await expect(getValidAccessToken('user-1')).rejects.toThrow(GoogleTokenError);
    await expect(getValidAccessToken('user-1')).rejects.toThrow('Google access token refresh failed: invalid_grant');
    expect(h.setGoogleConnectionError).toHaveBeenCalledWith('user-1', 'expired', 'invalid_grant');
    expect(h.refreshGoogleAccessToken).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the refresh call throws a non-Error value', async () => {
    h.getGoogleConnectionWithTokens.mockResolvedValue({
      ...baseConnection,
      tokenExpiresAt: new Date(Date.now() - 60_000),
    });
    h.refreshGoogleAccessTokenViaApi.mockRejectedValue('some string rejection');

    await expect(getValidAccessToken('user-1')).rejects.toThrow('Google access token refresh failed: Token refresh failed');
    expect(h.setGoogleConnectionError).toHaveBeenCalledWith('user-1', 'expired', 'Token refresh failed');
  });
});
