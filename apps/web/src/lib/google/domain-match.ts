/**
 * Matches a user's audited domains to their connected GSC/GA4 property, so
 * the AI-visibility-vs-traffic correlation section knows which audit history
 * belongs to which site. Exact hostname match is preferred; when nothing
 * matches, falls back to the most-recently-audited domain with a visible
 * low-confidence caveat — never silently guesses without flagging it.
 */

export interface DomainMatchResult {
  domain: string | null;
  confidence: 'exact' | 'fallback' | 'none';
}

function normalizeHostname(raw: string): string {
  return raw.trim().toLowerCase().replace(/^www\./, '').replace(/\/+$/, '');
}

/** GSC site URLs are either `sc-domain:example.com` or `https://example.com/`. */
export function hostnameFromGscSiteUrl(gscSiteUrl: string): string | null {
  const trimmed = gscSiteUrl.trim();
  if (trimmed.startsWith('sc-domain:')) {
    return normalizeHostname(trimmed.slice('sc-domain:'.length));
  }
  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return null;
  }
}

/**
 * `auditedDomains` should be ordered most-recently-audited first — that
 * ordering is what determines the fallback pick when no exact match exists.
 */
export function matchAuditDomainToConnection(
  auditedDomains: string[],
  gscSiteUrl: string | null,
): DomainMatchResult {
  if (auditedDomains.length === 0) return { domain: null, confidence: 'none' };

  const gscHostname = gscSiteUrl ? hostnameFromGscSiteUrl(gscSiteUrl) : null;
  if (gscHostname) {
    const exact = auditedDomains.find((d) => normalizeHostname(d) === gscHostname);
    if (exact) return { domain: exact, confidence: 'exact' };
  }

  return { domain: auditedDomains[0]!, confidence: 'fallback' };
}
