/**
 * Classifies errors from the googleapis client library (GaxiosError-shaped)
 * into a small set of actionable categories, replacing generic "request
 * failed" messages with something the user or an operator can act on.
 *
 * googleapis throws errors shaped like:
 *   { code: number, response: { status: number, data: { error: { status: string, message: string } } } }
 * Network failures (DNS, timeout, connection refused) instead surface a
 * Node.js system error with a `.code` like 'ENOTFOUND' / 'ETIMEDOUT' / 'ECONNREFUSED'.
 */

export type GoogleApiErrorCategory =
  | 'invalid_credentials'
  | 'expired_token'
  | 'revoked_token'
  | 'insufficient_permission'
  | 'not_found'
  | 'rate_limited'
  | 'network_failure'
  | 'unknown';

export interface ClassifiedGoogleApiError {
  category: GoogleApiErrorCategory;
  message: string;
  retryable: boolean;
}

interface GaxiosLikeError {
  code?: string | number;
  response?: {
    status?: number;
    data?: { error?: { status?: string; message?: string; errors?: Array<{ reason?: string }> } };
  };
  message?: string;
}

const NETWORK_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

function asGaxiosLike(err: unknown): GaxiosLikeError {
  return typeof err === 'object' && err !== null ? (err as GaxiosLikeError) : {};
}

export function classifyGoogleApiError(err: unknown): ClassifiedGoogleApiError {
  const e = asGaxiosLike(err);
  const rawMessage = e.message ?? (err instanceof Error ? err.message : String(err));

  if (typeof e.code === 'string' && NETWORK_ERROR_CODES.has(e.code)) {
    return {
      category: 'network_failure',
      message: 'Could not reach Google\'s servers (network error). This is usually transient — retry shortly.',
      retryable: true,
    };
  }

  const status = e.response?.status;
  const googleError = e.response?.data?.error;
  const googleStatus = googleError?.status;
  const googleMessage = googleError?.message ?? rawMessage;

  if (status === 401 || googleStatus === 'UNAUTHENTICATED') {
    // invalid_grant is Google's specific signal for a revoked or expired refresh token.
    if (/invalid_grant|revoked/i.test(googleMessage)) {
      return {
        category: 'revoked_token',
        message: 'Google access was revoked (commonly from myaccount.google.com/permissions, or the account password changed). Reconnect Google from Integrations to restore access.',
        retryable: false,
      };
    }
    return {
      category: 'invalid_credentials',
      message: 'Google rejected the stored credentials. Reconnect Google from Integrations.',
      retryable: false,
    };
  }

  if (status === 403 || googleStatus === 'PERMISSION_DENIED') {
    return {
      category: 'insufficient_permission',
      message: 'This Google account does not have permission to access the requested GA4 property or Search Console site. Confirm the connected account has at least Viewer access, then reconnect.',
      retryable: false,
    };
  }

  if (status === 404 || googleStatus === 'NOT_FOUND') {
    return {
      category: 'not_found',
      message: 'The selected GA4 property or Search Console site could not be found — it may have been deleted, or access was removed. Reselect a property from Integrations.',
      retryable: false,
    };
  }

  if (status === 429 || googleStatus === 'RESOURCE_EXHAUSTED') {
    return {
      category: 'rate_limited',
      message: 'Google API rate limit reached. This will resolve automatically on the next scheduled sync.',
      retryable: true,
    };
  }

  return { category: 'unknown', message: googleMessage || 'An unexpected error occurred while calling Google APIs.', retryable: false };
}
