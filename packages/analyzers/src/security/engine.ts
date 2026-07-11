/**
 * SiteNexis Security & Trust Scanner (Module 12).
 *
 * A pure analyzer — no HTTP. The crawl/route layer supplies whatever it has
 * (crawled pages, and optionally the homepage response headers / probe results);
 * this module scores it. Sections with no supplied input report `assessed: false`
 * rather than a fabricated 0, per the "insufficient data, not fake 0" rule.
 *
 * Works today on crawl data alone (secret exposure + trust signals). Security
 * headers and risky-file / admin-path probing activate once the caller passes
 * `homepageHeaders` / `probes` (a crawler enhancement).
 */

export type SecuritySeverity = 'critical' | 'warning' | 'info';

export interface SecurityPage {
  url: string;
  bodyText: string;
  title: string | null;
  internalLinks: string[];
  externalLinks: string[];
  /** Optional stringified structured data / raw markup to scan for leaked secrets. */
  extraText?: string;
}

export interface ProbeResult {
  path: string;
  /** HTTP status returned when probing the path (200 = exposed). */
  status: number;
}

export interface SecurityScanInput {
  pages: SecurityPage[];
  /** Lower-cased homepage response header map, if the crawler captured it. */
  homepageHeaders?: Record<string, string>;
  /** Results of probing risky/admin paths, if the crawler performed them. */
  probes?: ProbeResult[];
}

export interface SecurityFinding {
  category: 'security_header' | 'secret_exposure' | 'risky_file' | 'admin_exposure' | 'trust_signal';
  code: string;
  severity: SecuritySeverity;
  title: string;
  evidence: string;
  pageUrl: string | null;
  recommendation: string;
}

export interface SecurityHeaderResult {
  assessed: boolean;
  score: number | null;
  present: string[];
  missing: string[];
}

export interface TrustSignalResult {
  score: number;
  present: string[];
  missing: string[];
  socialProfiles: string[];
}

export interface SecurityTrustReport {
  overallScore: number | null;
  grade: 'strong' | 'moderate' | 'weak' | 'insufficient_data';
  headers: SecurityHeaderResult;
  trustSignals: TrustSignalResult;
  secretsFound: number;
  riskyFilesExposed: number;
  findings: SecurityFinding[];
}

// ── Security headers ────────────────────────────────────────────────────────

interface HeaderSpec {
  header: string;
  weight: number;
  severity: SecuritySeverity;
  recommendation: string;
}

const HEADER_SPECS: HeaderSpec[] = [
  { header: 'content-security-policy', weight: 30, severity: 'warning', recommendation: 'Add a Content-Security-Policy header to constrain script/style/connect sources.' },
  { header: 'strict-transport-security', weight: 25, severity: 'warning', recommendation: 'Add Strict-Transport-Security (HSTS) to force HTTPS on all subsequent requests.' },
  { header: 'x-content-type-options', weight: 15, severity: 'info', recommendation: 'Add "X-Content-Type-Options: nosniff" to stop MIME-type sniffing.' },
  { header: 'x-frame-options', weight: 15, severity: 'info', recommendation: 'Add X-Frame-Options (or CSP frame-ancestors) to prevent clickjacking.' },
  { header: 'referrer-policy', weight: 8, severity: 'info', recommendation: 'Add a Referrer-Policy header to control referrer leakage.' },
  { header: 'permissions-policy', weight: 7, severity: 'info', recommendation: 'Add a Permissions-Policy header to disable unused browser features.' },
];

function analyzeHeaders(headers: Record<string, string> | undefined): { result: SecurityHeaderResult; findings: SecurityFinding[] } {
  if (!headers) {
    return {
      result: { assessed: false, score: null, present: [], missing: HEADER_SPECS.map((h) => h.header) },
      findings: [],
    };
  }

  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;

  const present: string[] = [];
  const missing: string[] = [];
  const findings: SecurityFinding[] = [];
  let earned = 0;
  const total = HEADER_SPECS.reduce((s, h) => s + h.weight, 0);

  for (const spec of HEADER_SPECS) {
    if (lower[spec.header] != null && lower[spec.header] !== '') {
      present.push(spec.header);
      earned += spec.weight;
    } else {
      missing.push(spec.header);
      findings.push({
        category: 'security_header',
        code: `missing_${spec.header.replace(/-/g, '_')}`,
        severity: spec.severity,
        title: `Missing ${spec.header} header`,
        evidence: `Response did not include the ${spec.header} header.`,
        pageUrl: null,
        recommendation: spec.recommendation,
      });
    }
  }

  return {
    result: { assessed: true, score: Math.round((earned / total) * 100), present, missing },
    findings,
  };
}

// ── Secret exposure ─────────────────────────────────────────────────────────

interface SecretPattern {
  code: string;
  title: string;
  regex: RegExp;
  severity: SecuritySeverity;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { code: 'aws_access_key', title: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
  { code: 'google_api_key', title: 'Google API key', regex: /AIza[0-9A-Za-z_\-]{35}/g, severity: 'critical' },
  { code: 'stripe_secret_key', title: 'Stripe secret key', regex: /sk_live_[0-9A-Za-z]{20,}/g, severity: 'critical' },
  { code: 'slack_token', title: 'Slack token', regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g, severity: 'critical' },
  { code: 'private_key', title: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, severity: 'critical' },
  { code: 'jwt', title: 'JSON Web Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'warning' },
  { code: 'generic_secret', title: 'Hard-coded secret assignment', regex: /(?:api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/gi, severity: 'warning' },
];

function redact(match: string): string {
  const head = match.slice(0, 6);
  return `${head}${'•'.repeat(Math.min(8, Math.max(0, match.length - 6)))} (redacted)`;
}

function scanSecrets(pages: SecurityPage[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const haystack = `${page.bodyText}\n${page.extraText ?? ''}`;
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.regex.exec(haystack)) !== null) {
        const key = `${pattern.code}:${m[0]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          category: 'secret_exposure',
          code: pattern.code,
          severity: pattern.severity,
          title: `Possible exposed ${pattern.title}`,
          evidence: redact(m[0]),
          pageUrl: page.url,
          recommendation: 'Remove the secret from page content, rotate the credential immediately, and serve it only from server-side environment variables.',
        });
      }
    }
  }
  return findings;
}

// ── Risky files / admin exposure (probe-driven) ─────────────────────────────

const RISKY_FILE_PATHS = new Set(['/.env', '/config.php', '/backup.zip', '/db.sql', '/wp-config.php.bak', '/.git/config']);
const ADMIN_PATHS = new Set(['/admin', '/wp-admin', '/login']);

function analyzeProbes(probes: ProbeResult[] | undefined): { findings: SecurityFinding[]; riskyExposed: number } {
  if (!probes || probes.length === 0) return { findings: [], riskyExposed: 0 };

  const findings: SecurityFinding[] = [];
  let riskyExposed = 0;

  for (const probe of probes) {
    const exposed = probe.status >= 200 && probe.status < 300;
    if (!exposed) continue;
    if (RISKY_FILE_PATHS.has(probe.path)) {
      riskyExposed++;
      findings.push({
        category: 'risky_file',
        code: 'risky_file_exposed',
        severity: 'critical',
        title: `Sensitive file publicly accessible: ${probe.path}`,
        evidence: `${probe.path} returned HTTP ${probe.status}.`,
        pageUrl: probe.path,
        recommendation: `Block public access to ${probe.path} at the server/CDN, and remove it from the web root.`,
      });
    } else if (ADMIN_PATHS.has(probe.path)) {
      findings.push({
        category: 'admin_exposure',
        code: 'admin_path_reachable',
        severity: 'info',
        title: `Admin surface reachable: ${probe.path}`,
        evidence: `${probe.path} returned HTTP ${probe.status}.`,
        pageUrl: probe.path,
        recommendation: `Ensure ${probe.path} enforces authentication and rate limiting; consider IP allow-listing.`,
      });
    }
  }
  return { findings, riskyExposed };
}

// ── Trust signals ───────────────────────────────────────────────────────────

const TRUST_PAGES: { key: string; test: RegExp }[] = [
  { key: 'contact', test: /contact/i },
  { key: 'privacy', test: /privacy/i },
  { key: 'terms', test: /terms|\/tos\b/i },
  { key: 'about', test: /about/i },
];

const SOCIAL_HOSTS: { key: string; test: RegExp }[] = [
  { key: 'linkedin', test: /linkedin\.com/i },
  { key: 'twitter/x', test: /(twitter\.com|(?:^|\/\/)x\.com)/i },
  { key: 'facebook', test: /facebook\.com/i },
  { key: 'instagram', test: /instagram\.com/i },
  { key: 'youtube', test: /youtube\.com|youtu\.be/i },
  { key: 'github', test: /github\.com/i },
  { key: 'tiktok', test: /tiktok\.com/i },
];

function analyzeTrustSignals(pages: SecurityPage[]): { result: TrustSignalResult; findings: SecurityFinding[] } {
  const allInternal = pages.flatMap((p) => [p.url, ...p.internalLinks]);
  const allExternal = pages.flatMap((p) => p.externalLinks);

  const present: string[] = [];
  const missing: string[] = [];
  for (const tp of TRUST_PAGES) {
    if (allInternal.some((u) => tp.test.test(u))) present.push(tp.key);
    else missing.push(tp.key);
  }

  const socialProfiles = SOCIAL_HOSTS.filter((s) => allExternal.some((u) => s.test.test(u))).map((s) => s.key);

  // 60% from trust pages, 40% from having at least a couple of social profiles.
  const pageScore = (present.length / TRUST_PAGES.length) * 60;
  const socialScore = Math.min(1, socialProfiles.length / 2) * 40;
  const score = Math.round(pageScore + socialScore);

  const findings: SecurityFinding[] = [];
  for (const key of missing) {
    findings.push({
      category: 'trust_signal',
      code: `missing_${key}_page`,
      severity: key === 'privacy' || key === 'contact' ? 'warning' : 'info',
      title: `No ${key} page detected`,
      evidence: `No internal link matched a ${key} page.`,
      pageUrl: null,
      recommendation: `Add a clearly linked ${key} page — it is a trust signal for both users and AI systems.`,
    });
  }
  if (socialProfiles.length === 0) {
    findings.push({
      category: 'trust_signal',
      code: 'no_social_profiles',
      severity: 'info',
      title: 'No linked social profiles',
      evidence: 'No external links pointed to known social platforms.',
      pageUrl: null,
      recommendation: 'Link official social profiles (and mirror them via schema sameAs) to strengthen entity validation.',
    });
  }

  return { result: { score, present, missing, socialProfiles }, findings };
}

// ── Orchestrator ────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<SecuritySeverity, number> = { critical: 0, warning: 1, info: 2 };

export function buildSecurityTrustReport(input: SecurityScanInput): SecurityTrustReport {
  const headers = analyzeHeaders(input.homepageHeaders);
  const trust = analyzeTrustSignals(input.pages);
  const secretFindings = scanSecrets(input.pages);
  const probes = analyzeProbes(input.probes);

  const findings = [...headers.findings, ...secretFindings, ...probes.findings, ...trust.findings]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Overall: blend trust with headers when assessed; always penalise exposed secrets/files.
  const secretPenalty = secretFindings.reduce((s, f) => s + (f.severity === 'critical' ? 30 : 12), 0);
  const riskyPenalty = probes.riskyExposed * 30;

  let base: number;
  if (headers.result.assessed && headers.result.score !== null) {
    base = headers.result.score * 0.5 + trust.result.score * 0.5;
  } else {
    base = trust.result.score;
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(base - secretPenalty - riskyPenalty)));

  const grade: SecurityTrustReport['grade'] =
    overallScore >= 75 ? 'strong' : overallScore >= 50 ? 'moderate' : 'weak';

  return {
    overallScore,
    grade,
    headers: headers.result,
    trustSignals: trust.result,
    secretsFound: secretFindings.length,
    riskyFilesExposed: probes.riskyExposed,
    findings,
  };
}
