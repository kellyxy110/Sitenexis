/**
 * RedLab — passive, read-only attack-surface reconnaissance. Distinct from
 * Machine Trust Security (prompt-injection/exploit signals in content) and
 * AI Governance (declared AI-use policy): RedLab checks for accidentally
 * exposed sensitive paths and outdated JS libraries with known CVEs.
 *
 * Deliberately non-invasive: HEAD/GET probes against a fixed path list and
 * regex version matching against already-crawled script sources. Never
 * attempts exploitation, authentication bypass, or payload injection —
 * audits run against arbitrary user-submitted domains, not confirmed-owned
 * properties, so active attack techniques are out of scope by design.
 */

export type RedLabSeverity = 'critical' | 'warning' | 'info';

export interface ExposedPathFinding {
  path: string;
  statusCode: number;
  description: string;
  severity: RedLabSeverity;
}

export interface VulnerableLibraryFinding {
  library: string;
  detectedVersion: string;
  knownVulnerableBelow: string;
  cveReferences: string[];
  severity: RedLabSeverity;
  scriptSource: string;
}

export interface RedLabIssue {
  code: string;
  severity: RedLabSeverity;
  title: string;
  explanation: string;
  recommendation: string;
  evidence: string;
}

export interface RedLabScoreBreakdown {
  exposedPathFreedom: number;
  /** null when no recognized library version strings were found at all — not scored as clean. */
  libraryFreshness: number | null;
}

export interface RedLabReport {
  version: 'redlab-v1';
  assessedAt: string;
  overallScore: number;
  scoreBreakdown: RedLabScoreBreakdown;
  exposedPaths: ExposedPathFinding[];
  vulnerableLibraries: VulnerableLibraryFinding[];
  pathsChecked: number;
  issues: RedLabIssue[];
  limitations: string[];
}
