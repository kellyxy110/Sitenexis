import { describe, it, expect } from 'vitest';
import { classifyGoogleApiError } from '../error-classifier';

function gaxiosError(status: number, googleStatus: string, message: string) {
  return { response: { status, data: { error: { status: googleStatus, message } } } };
}

describe('classifyGoogleApiError', () => {
  it('classifies invalid_grant on a 401 as a revoked token, not a generic credentials error', () => {
    const result = classifyGoogleApiError(gaxiosError(401, 'UNAUTHENTICATED', 'invalid_grant: Token has been revoked'));
    expect(result.category).toBe('revoked_token');
    expect(result.retryable).toBe(false);
    expect(result.message).toMatch(/reconnect/i);
  });

  it('classifies a plain 401 as invalid credentials', () => {
    const result = classifyGoogleApiError(gaxiosError(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.'));
    expect(result.category).toBe('invalid_credentials');
  });

  it('classifies a 403 as insufficient permission', () => {
    const result = classifyGoogleApiError(gaxiosError(403, 'PERMISSION_DENIED', 'The caller does not have permission'));
    expect(result.category).toBe('insufficient_permission');
    expect(result.retryable).toBe(false);
  });

  it('classifies a 404 as not found', () => {
    const result = classifyGoogleApiError(gaxiosError(404, 'NOT_FOUND', 'Requested entity was not found.'));
    expect(result.category).toBe('not_found');
  });

  it('classifies a 429 as rate limited and retryable', () => {
    const result = classifyGoogleApiError(gaxiosError(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded'));
    expect(result.category).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('classifies a Node network error code as a retryable network failure', () => {
    const result = classifyGoogleApiError({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' });
    expect(result.category).toBe('network_failure');
    expect(result.retryable).toBe(true);
  });

  it('falls back to unknown for an unrecognized shape without throwing', () => {
    const result = classifyGoogleApiError(new Error('something odd'));
    expect(result.category).toBe('unknown');
    expect(result.message).toBe('something odd');
  });
});
