/**
 * Bot-mitigation / WAF vendor detection from HTTP response signals.
 *
 * Purely signature-based on response headers (and optionally the response body).
 * NO domain-specific logic — this classifies ANY site exhibiting a given vendor's
 * fingerprint, so a fix for one Akamai/Cloudflare site fixes all of them.
 *
 * Used when a crawl is blocked (403/429/503 or empty) to turn a silent/blank
 * failure into an explicit "failed with explanation" that names the protection
 * and tells the user how to proceed (headless renderer / allowlisting).
 */

export type BotMitigationVendor =
  | 'akamai'
  | 'cloudflare'
  | 'imperva'
  | 'fastly'
  | 'sucuri'
  | 'aws'
  | 'datadome'
  | 'perimeterx'
  | 'unknown';

export interface BotMitigationResult {
  /** True when the response looks like an automated-access block, not an ordinary error. */
  blocked: boolean;
  vendor: BotMitigationVendor;
  /** Human-readable vendor name for UI/report copy. */
  vendorLabel: string;
  /** The specific header/body signals that triggered the classification. */
  evidence: string[];
  /** One-sentence, actionable explanation for the user. */
  explanation: string;
}

const VENDOR_LABELS: Record<BotMitigationVendor, string> = {
  akamai: 'Akamai Bot Manager',
  cloudflare: 'Cloudflare',
  imperva: 'Imperva / Incapsula',
  fastly: 'Fastly',
  sucuri: 'Sucuri',
  aws: 'AWS WAF / CloudFront',
  datadome: 'DataDome',
  perimeterx: 'PerimeterX / HUMAN',
  unknown: 'an unidentified bot-mitigation / WAF layer',
};

/** Lower-case a headers map defensively (callers may pass mixed-case keys). */
function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = typeof v === 'string' ? v : String(v ?? '');
  }
  return out;
}

/**
 * Classify a (possibly blocked) HTTP response by bot-mitigation vendor.
 *
 * @param statusCode  HTTP status of the response (0/undefined = no response / timeout)
 * @param headers     Response headers (any case)
 * @param body        Optional response body snippet (helps for Akamai edge error pages)
 */
export function detectBotMitigation(
  statusCode: number | undefined,
  headers: Record<string, string> | undefined,
  body?: string,
): BotMitigationResult {
  const h = normalizeHeaders(headers);
  const evidence: string[] = [];
  const bodyLc = (body ?? '').toLowerCase();

  const server = h['server'] ?? '';
  const setCookie = h['set-cookie'] ?? '';
  const via = h['via'] ?? '';

  let vendor: BotMitigationVendor = 'unknown';

  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(h, key);

  // ── Akamai ────────────────────────────────────────────────────────────────
  if (
    /akamai/i.test(server) ||
    has('x-akamai-transformed') ||
    has('x-akamai-request-id') ||
    /akamai/i.test(via) ||
    /edgesuite\.net|errors\.edgekey|akamai/i.test(bodyLc)
  ) {
    vendor = 'akamai';
    if (/akamai/i.test(server)) evidence.push(`server: ${server}`);
    if (has('x-akamai-transformed')) evidence.push('x-akamai-transformed header');
    if (/edgesuite\.net|akamai/i.test(bodyLc)) evidence.push('Akamai edge error reference in body');
  }
  // ── Cloudflare ──────────────────────────────────────────────────────────────
  else if (/cloudflare/i.test(server) || has('cf-ray') || has('cf-mitigated') || has('cf-chl-bypass')) {
    vendor = 'cloudflare';
    if (has('cf-ray')) evidence.push(`cf-ray: ${h['cf-ray']}`);
    if (/cloudflare/i.test(server)) evidence.push(`server: ${server}`);
    if (has('cf-mitigated')) evidence.push('cf-mitigated header');
  }
  // ── Imperva / Incapsula ─────────────────────────────────────────────────────
  else if (
    has('x-iinfo') ||
    (has('x-cdn') && /incapsula/i.test(h['x-cdn'] ?? '')) ||
    /incap_ses|visid_incap/i.test(setCookie)
  ) {
    vendor = 'imperva';
    if (has('x-iinfo')) evidence.push('x-iinfo header');
    if (/incap_ses|visid_incap/i.test(setCookie)) evidence.push('Incapsula session cookie');
  }
  // ── DataDome ────────────────────────────────────────────────────────────────
  else if (has('x-datadome') || has('x-dd-b') || /datadome/i.test(setCookie)) {
    vendor = 'datadome';
    evidence.push('DataDome header/cookie');
  }
  // ── PerimeterX / HUMAN ──────────────────────────────────────────────────────
  else if (has('x-px') || /_px[0-9]?=/i.test(setCookie)) {
    vendor = 'perimeterx';
    evidence.push('PerimeterX header/cookie');
  }
  // ── Sucuri ──────────────────────────────────────────────────────────────────
  else if (/sucuri/i.test(server) || has('x-sucuri-id') || has('x-sucuri-cache')) {
    vendor = 'sucuri';
    if (/sucuri/i.test(server)) evidence.push(`server: ${server}`);
    if (has('x-sucuri-id')) evidence.push('x-sucuri-id header');
  }
  // ── Fastly ──────────────────────────────────────────────────────────────────
  else if (/fastly/i.test(server) || has('x-fastly-request-id') || (/varnish/i.test(via) && has('x-served-by'))) {
    vendor = 'fastly';
    if (has('x-served-by')) evidence.push(`x-served-by: ${h['x-served-by']}`);
    if (/fastly/i.test(server)) evidence.push(`server: ${server}`);
  }
  // ── AWS WAF / CloudFront ────────────────────────────────────────────────────
  else if (/cloudfront/i.test(server) || has('x-amz-cf-id') || has('x-amzn-waf-action')) {
    vendor = 'aws';
    if (has('x-amz-cf-id')) evidence.push('x-amz-cf-id header');
    if (/cloudfront/i.test(server)) evidence.push(`server: ${server}`);
  }

  // "blocked" = an access-denied / challenge status, OR a challenge from a known vendor.
  const challengeStatus = statusCode === 403 || statusCode === 429 || statusCode === 503;
  const noResponse = statusCode === undefined || statusCode === 0;
  const blocked = challengeStatus || (noResponse && vendor !== 'unknown');

  const vendorLabel = VENDOR_LABELS[vendor];
  const statusPart = challengeStatus ? `HTTP ${statusCode}` : noResponse ? 'no response' : `HTTP ${statusCode}`;

  const explanation = blocked
    ? vendor === 'unknown'
      ? `The site denied automated access (${statusPart}) via ${vendorLabel}. Enable the headless renderer (set CRAWL4AI_URL) to audit protected sites, or allowlist the SiteNexis crawler.`
      : `The site is protected by ${vendorLabel}, which denied automated access (${statusPart}). Enable the headless renderer (set CRAWL4AI_URL) to audit bot-protected sites, or allowlist the SiteNexis crawler user-agent.`
    : `Received ${statusPart}${vendor !== 'unknown' ? ` behind ${vendorLabel}` : ''}.`;

  return { blocked, vendor, vendorLabel, evidence, explanation };
}
