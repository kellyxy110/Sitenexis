// URL safety checks for web extraction adapters.
// Blocks SSRF vectors: private IP ranges, loopback, link-local, internal hostnames.

const BLOCKED_PATTERNS = [
  // IPv4 private + loopback + link-local
  /^(10\.\d+\.\d+\.\d+)$/,
  /^(172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/,
  /^(192\.168\.\d+\.\d+)$/,
  /^(127\.\d+\.\d+\.\d+)$/,
  /^(0\.0\.0\.0)$/,
  /^(169\.254\.\d+\.\d+)$/,
  // IPv6 loopback + link-local
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

// Internal hostnames that look legitimate but resolve locally
const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'metadata.google.internal', '169.254.169.254',
  'instance-data', '100.100.100.200', // AWS/GCP/Alibaba metadata
]);

export class URLValidationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'URLValidationError';
  }
}

/**
 * Validates a URL for safe external extraction.
 * Throws URLValidationError if the URL is unsafe.
 */
export function validateExtractionUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new URLValidationError(`Invalid URL: ${rawUrl}`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new URLValidationError(`Scheme not allowed: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new URLValidationError(`Blocked hostname: ${hostname}`);
  }

  // Block bare IPv4 literals in blocked ranges
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new URLValidationError(`Blocked IP range: ${hostname}`);
    }
  }

  return parsed;
}

/**
 * Returns true if the URL is safe, false otherwise.
 * Non-throwing convenience wrapper for validateExtractionUrl.
 */
export function isSafeUrl(rawUrl: string): boolean {
  try {
    validateExtractionUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
