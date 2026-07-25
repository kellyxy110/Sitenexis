import type {
  ExposedPathFinding,
  RedLabIssue,
  RedLabReport,
  RedLabSeverity,
  VulnerableLibraryFinding,
} from '@sitenexis/shared';

export interface PathProbeResult {
  path: string;
  statusCode: number;
}

export interface RedLabInput {
  pathProbeResults: PathProbeResult[];
  scriptSources: string[];
}

interface SensitivePathRule {
  path: string;
  description: string;
  severity: RedLabSeverity;
}

// Read-only exposure checks only — never an auth-bypass or payload-injection attempt.
const SENSITIVE_PATHS: SensitivePathRule[] = [
  { path: '/.env', description: 'Environment file, often containing database credentials and API keys.', severity: 'critical' },
  { path: '/.git/config', description: 'Git repository metadata, can expose source history and remote credentials.', severity: 'critical' },
  { path: '/.aws/credentials', description: 'AWS credentials file.', severity: 'critical' },
  { path: '/wp-config.php.bak', description: 'WordPress config backup, often contains database credentials in plaintext.', severity: 'critical' },
  { path: '/.htpasswd', description: 'Apache password file.', severity: 'critical' },
  { path: '/backup.sql', description: 'Common database backup filename.', severity: 'warning' },
  { path: '/.DS_Store', description: 'macOS Finder metadata file, can reveal directory structure.', severity: 'info' },
  { path: '/.svn/entries', description: 'Subversion repository metadata.', severity: 'warning' },
  { path: '/phpinfo.php', description: 'PHP configuration disclosure page.', severity: 'warning' },
  { path: '/server-status', description: 'Apache server-status page, can reveal internal request details.', severity: 'warning' },
  { path: '/actuator/env', description: 'Spring Boot Actuator environment endpoint, can expose configuration and secrets.', severity: 'critical' },
  { path: '/.well-known/traffic-advice', description: 'Rarely configured; presence alone is informational.', severity: 'info' },
  { path: '/wp-login.php', description: 'WordPress admin login — expected on WordPress sites, informational only.', severity: 'info' },
  { path: '/config.json', description: 'Generic application config file.', severity: 'warning' },
];

interface VulnerableLibraryRule {
  library: string;
  pattern: RegExp;
  vulnerableBelow: string;
  isVulnerable: (version: string) => boolean;
  cveReferences: string[];
  severity: RedLabSeverity;
}

function versionBelow(version: string, threshold: string): boolean {
  const v = version.split('.').map((n) => parseInt(n, 10) || 0);
  const t = threshold.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(v.length, t.length); i++) {
    const a = v[i] ?? 0;
    const b = t[i] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

// Small, deterministic, hand-maintained list — not a live CVE feed. Update as
// new widely-deployed vulnerable versions become relevant.
const VULNERABLE_LIBRARIES: VulnerableLibraryRule[] = [
  { library: 'jQuery', pattern: /jquery[.-]?(\d+\.\d+\.\d+)/i, vulnerableBelow: '3.5.0', isVulnerable: (v) => versionBelow(v, '3.5.0'), cveReferences: ['CVE-2020-11022', 'CVE-2020-11023'], severity: 'warning' },
  { library: 'Bootstrap', pattern: /bootstrap[.-]?(\d+\.\d+\.\d+)/i, vulnerableBelow: '4.3.1', isVulnerable: (v) => versionBelow(v, '4.3.1'), cveReferences: ['CVE-2019-8331'], severity: 'warning' },
  { library: 'Lodash', pattern: /lodash[.-]?(\d+\.\d+\.\d+)/i, vulnerableBelow: '4.17.21', isVulnerable: (v) => versionBelow(v, '4.17.21'), cveReferences: ['CVE-2021-23337'], severity: 'warning' },
  { library: 'Moment.js', pattern: /moment[.-]?(\d+\.\d+\.\d+)/i, vulnerableBelow: '2.29.4', isVulnerable: (v) => versionBelow(v, '2.29.4'), cveReferences: ['CVE-2022-31129'], severity: 'warning' },
  { library: 'Angular.js', pattern: /angular(?:js)?[.-]?(\d+\.\d+\.\d+)/i, vulnerableBelow: '1.8.0', isVulnerable: (v) => versionBelow(v, '1.8.0'), cveReferences: ['CVE-2020-7676'], severity: 'critical' },
];

function detectVulnerableLibraries(scriptSources: string[]): VulnerableLibraryFinding[] {
  const findings: VulnerableLibraryFinding[] = [];
  for (const src of scriptSources) {
    for (const rule of VULNERABLE_LIBRARIES) {
      const match = rule.pattern.exec(src);
      const version = match?.[1];
      if (!version) continue;
      if (rule.isVulnerable(version)) {
        findings.push({
          library: rule.library,
          detectedVersion: version,
          knownVulnerableBelow: rule.vulnerableBelow,
          cveReferences: rule.cveReferences,
          severity: rule.severity,
          scriptSource: src,
        });
      }
    }
  }
  return findings;
}

export function buildRedLabReport(input: RedLabInput): RedLabReport {
  const issues: RedLabIssue[] = [];

  const exposedPaths: ExposedPathFinding[] = [];
  for (const result of input.pathProbeResults) {
    if (result.statusCode < 200 || result.statusCode >= 300) continue;
    const rule = SENSITIVE_PATHS.find((r) => r.path === result.path);
    if (!rule) continue;
    exposedPaths.push({ path: result.path, statusCode: result.statusCode, description: rule.description, severity: rule.severity });
    issues.push({
      code: `exposed_path_${rule.path.replace(/[^a-z0-9]+/gi, '_')}`,
      severity: rule.severity,
      title: `${rule.path} is publicly reachable`,
      explanation: rule.description,
      recommendation: rule.severity === 'info'
        ? 'No action required — this path is expected or low-risk, listed for completeness.'
        : `Remove public access to ${rule.path} (server config, .htaccess deny rule, or move the file outside the web root).`,
      evidence: `HTTP ${result.statusCode} at ${rule.path}`,
    });
  }

  const vulnerableLibraries = detectVulnerableLibraries(input.scriptSources);
  for (const lib of vulnerableLibraries) {
    issues.push({
      code: `vulnerable_library_${lib.library.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      severity: lib.severity,
      title: `${lib.library} ${lib.detectedVersion} has known vulnerabilities`,
      explanation: `${lib.library} versions below ${lib.knownVulnerableBelow} are affected by ${lib.cveReferences.join(', ')}.`,
      recommendation: `Upgrade ${lib.library} to ${lib.knownVulnerableBelow} or later.`,
      evidence: lib.scriptSource,
    });
  }

  const criticalPenalty = 30;
  const warningPenalty = 12;
  const infoPenalty = 2;
  const penaltyFor = (severity: RedLabSeverity) =>
    severity === 'critical' ? criticalPenalty : severity === 'warning' ? warningPenalty : infoPenalty;

  const exposedPathFreedom = Math.max(0, 100 - exposedPaths.reduce((sum, f) => sum + penaltyFor(f.severity), 0));
  const libraryFreshness = input.scriptSources.length === 0
    ? null
    : Math.max(0, 100 - vulnerableLibraries.reduce((sum, f) => sum + penaltyFor(f.severity), 0));

  const components = [exposedPathFreedom, libraryFreshness].filter((v): v is number => v !== null);
  const overallScore = Math.round(components.reduce((sum, v) => sum + v, 0) / components.length);

  return {
    version: 'redlab-v1',
    assessedAt: new Date().toISOString(),
    overallScore,
    scoreBreakdown: { exposedPathFreedom, libraryFreshness },
    exposedPaths,
    vulnerableLibraries,
    pathsChecked: input.pathProbeResults.length,
    issues,
    limitations: [
      'RedLab is passive and read-only: it checks whether known sensitive paths return a successful response and detects outdated library version strings. It never attempts authentication bypass, exploitation, or payload injection.',
      'A clean result means these specific checks found nothing — it does not certify the site is free of vulnerabilities.',
      'Vulnerable-library detection depends on the version number appearing in the script filename or URL; minified or renamed bundles without a version string are not detected.',
    ],
  };
}
