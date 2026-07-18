import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  env: {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/api/integrations/google/callback',
    GOOGLE_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), // valid 32-byte hex key
  },
}));

vi.mock('@/lib/env', () => ({ env: h.env }));

const { encryptToken, decryptToken, isGoogleOAuthConfigured, GoogleTokenEncryptionError } = await import('../crypto');

describe('Google token encryption', () => {
  beforeEach(() => {
    h.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    h.env.GOOGLE_CLIENT_ID = 'test-client-id';
    h.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    h.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback';
  });

  it('round-trips a plaintext token through encrypt then decrypt', () => {
    const plaintext = 'ya29.a0-fake-access-token-value';
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV) even for the same plaintext', () => {
    const plaintext = 'same-token-value';
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });

  it('throws on a tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encryptToken('a-real-refresh-token');
    const buf = Buffer.from(encrypted, 'base64');
    buf[buf.length - 1] = (buf[buf.length - 1]! + 1) % 256; // flip last ciphertext byte
    expect(() => decryptToken(buf.toString('base64'))).toThrow();
  });

  it('throws a clear error when GOOGLE_TOKEN_ENCRYPTION_KEY is missing', () => {
    h.env.GOOGLE_TOKEN_ENCRYPTION_KEY = '';
    expect(() => encryptToken('x')).toThrow(GoogleTokenEncryptionError);
  });

  it('throws a clear error when GOOGLE_TOKEN_ENCRYPTION_KEY is the wrong length', () => {
    h.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'not-64-hex-chars';
    expect(() => encryptToken('x')).toThrow(GoogleTokenEncryptionError);
  });

  it('isGoogleOAuthConfigured is true only when all four vars are valid', () => {
    expect(isGoogleOAuthConfigured()).toBe(true);
    h.env.GOOGLE_CLIENT_ID = '';
    expect(isGoogleOAuthConfigured()).toBe(false);
  });
});
