/**
 * AES-256-GCM encryption for Google OAuth tokens at rest.
 *
 * Format: base64(iv[12 bytes] + authTag[16 bytes] + ciphertext) — a single
 * self-contained string, so the DB schema only ever needs one column per token.
 * Never logged, never returned in any API response — only ever read back
 * server-side to make a Google API call.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

class GoogleTokenEncryptionError extends Error {}

function getKey(): Buffer {
  const raw = env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new GoogleTokenEncryptionError(
      'GOOGLE_TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32',
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new GoogleTokenEncryptionError(
      'GOOGLE_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32',
    );
  }
  return Buffer.from(raw, 'hex');
}

/** Encrypt a plaintext OAuth token (access or refresh) into a storable string. */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Decrypt a token previously produced by encryptToken. Throws on tampering or a wrong key. */
export function decryptToken(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new GoogleTokenEncryptionError('Encrypted token payload is malformed or truncated.');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.GOOGLE_OAUTH_REDIRECT_URI &&
    /^[0-9a-fA-F]{64}$/.test(env.GOOGLE_TOKEN_ENCRYPTION_KEY),
  );
}

export { GoogleTokenEncryptionError };
