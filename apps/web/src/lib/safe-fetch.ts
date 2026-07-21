/**
 * SSRF-safe fetch helpers for routes that fetch a user-supplied URL/domain
 * (quick-audit, MTS). Shared so both routes get identical protection instead
 * of each reimplementing the private-host check and risking drift.
 */

// Private / reserved / loopback addresses an SSRF probe must never be able to reach.
// Covers IPv4 (loopback, RFC1918, link-local, unspecified) and IPv6 (loopback ::1,
// unspecified ::, IPv4-mapped ::ffff:, ULA fc00::/7 → fc/fd, link-local fe80::/10).
const PRIVATE_IP_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1?$|::ffff:|f[cd][0-9a-f]{2}:|fe80:)/i;

/** True if the URL resolves to a private/reserved/loopback host (IPv4 or IPv6). */
export function isPrivateHostUrl(u: string): boolean {
  try {
    // Node keeps IPv6 hosts bracketed in `.hostname` (e.g. "[::1]") — strip the
    // brackets before matching so IPv6 loopback/link-local can't slip through.
    const host = new URL(u).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return PRIVATE_IP_RE.test(host);
  } catch {
    return true; // unparseable → treat as disallowed
  }
}

/**
 * Fetch that follows redirects manually, re-validating the host at EVERY hop.
 * `redirect: 'follow'` is an SSRF hole: a public URL can 302 to http://169.254.169.254/
 * (cloud metadata) or another internal host, and fetch would dutifully request it.
 * Here each Location is resolved and checked against the private-host filter before
 * it is followed; a redirect toward a private/reserved host aborts.
 */
export async function fetchNoInternalRedirects(
  startUrl: string,
  init: RequestInit,
  maxHops = 5,
): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(current, { ...init, redirect: 'manual' });
    // undici surfaces a manual redirect as an opaqueredirect/3xx with a Location.
    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location');
    if (!isRedirect) return res;
    const next = new URL(res.headers.get('location') as string, current).href;
    if (isPrivateHostUrl(next)) {
      const e = new Error('Redirect to a private or reserved address was blocked') as Error & { code?: string };
      e.name = 'SSRFRedirectError';
      e.code = 'SSRF_REDIRECT';
      throw e;
    }
    current = next;
  }
  const e = new Error('Too many redirects') as Error & { code?: string };
  e.name = 'TooManyRedirects';
  throw e;
}
