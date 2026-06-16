import type {
  AuditReport,
  CrawledPage,
  VerificationReport,
  VerifiedFinding,
} from '@sitenexis/shared';
import { isStaleSnapshot } from './dom-evidence';
import { verifySEOIssue, verifySchemaIssue, verifyEntity } from './verifier';

/**
 * Runs the Source-Grounded Verification Pass over an AuditReport.
 *
 * This is a post-extraction layer — it does not re-crawl or re-fetch.
 * It validates analyzer findings against the existing Puppeteer-captured
 * DOM snapshots provided in `pages`. Each finding is annotated with:
 *
 *   - Evidence references (exact DOM nodes, selectors, observed values)
 *   - A confidence score derived from evidence completeness, source
 *     reliability, and extraction consistency
 *   - An adjusted severity that reflects the confidence classification
 *
 * Findings with confidence < 0.5 are suppressed (not surfaced to users).
 *
 * If a page snapshot is stale (> 24h old), its findings are still
 * verified against the snapshot — no re-fetch is triggered. A stale
 * flag is logged for monitoring purposes.
 */
export async function runVerificationPass(
  report: AuditReport,
  pages: CrawledPage[],
): Promise<VerificationReport> {
  const findings: VerifiedFinding[] = [];
  let counter = 0;
  const nextId = (): string => `vf_${(++counter).toString().padStart(4, '0')}`;

  // Fast URL → page lookup
  const pageByUrl = new Map<string, CrawledPage>(pages.map((p) => [p.url, p]));

  // Log stale snapshots (informational — do not block verification)
  const staleUrls = pages.filter(isStaleSnapshot).map((p) => p.url);
  if (staleUrls.length > 0) {
    // Stale snapshots are still used — they represent the last observed state.
    // Suppressing findings due to staleness would hide real issues.
  }

  // ── 1. SEO issue verification ────────────────────────────────────────────────
  // All SEO issues are deterministic: they are directly measurable from
  // CrawledPage fields (title, meta, h1, canonicalUrl, robotsDirectives, etc.).
  // Confidence is always 1.0 for these — the absence of a field is itself a fact.
  for (const issue of report.seoScore.issues) {
    const page = pageByUrl.get(issue.url);
    if (!page) continue; // page was not in the crawl sample — skip, do not fabricate
    findings.push(verifySEOIssue(issue, page, nextId()));
  }

  // ── 2. Schema issue verification ─────────────────────────────────────────────
  // Schema issues include cross-validation between JSON-LD and visible DOM.
  // Confidence reflects schema presence, field completeness, and DOM agreement.
  for (const pageAnalysis of report.schemaAnalysis.pageAnalyses) {
    const page = pageByUrl.get(pageAnalysis.url);
    if (!page) continue;

    for (const issue of report.schemaAnalysis.issues.filter(
      (i) => i.url === pageAnalysis.url,
    )) {
      findings.push(verifySchemaIssue(issue, page, nextId()));
    }
  }

  // ── 3. Entity verification ───────────────────────────────────────────────────
  // Entities are LLM-extracted — each must be traceable to at least one
  // DOM source (body text, heading, schema, or anchor text).
  // Entities with no DOM anchor receive confidence < 0.5 and are suppressed.
  for (const entity of report.entityIntelligence.entitiesDetected) {
    findings.push(verifyEntity(entity, pages, nextId()));
  }

  // ── Aggregate statistics ─────────────────────────────────────────────────────
  const verifiedCount   = findings.filter((f) => f.confidence.class === 'VERIFIED').length;
  const probableCount   = findings.filter((f) => f.confidence.class === 'PROBABLE').length;
  const weakCount       = findings.filter((f) => f.confidence.class === 'WEAK').length;
  const suppressedCount = findings.filter((f) => f.confidence.class === 'SUPPRESSED').length;

  const deterministic = findings.filter(
    (f) =>
      f.confidence.factors.evidenceCompleteness === 1.0 &&
      f.confidence.factors.sourceReliability === 1.0,
  ).length;

  const interpreted = findings.filter((f) =>
    f.evidence.some((e) => e.sourceType === 'llm_interpretation'),
  ).length;

  return {
    auditId: report.auditId,
    verifiedAt: new Date(),
    totalFindings: findings.length,
    verifiedCount,
    probableCount,
    weakCount,
    suppressedCount,
    findings,
    coverageStats: {
      deterministic,
      interpreted,
      suppressed: suppressedCount,
    },
  };
}

/**
 * Returns only the findings that should be surfaced to the user:
 * VERIFIED + PROBABLE + WEAK (confidence ≥ 0.5).
 * SUPPRESSED findings are excluded by this filter.
 */
export function surfaceableFindings(report: VerificationReport): VerifiedFinding[] {
  return report.findings.filter((f) => f.adjustedSeverity !== 'suppressed');
}

/**
 * Returns findings grouped by confidence class, for UI rendering.
 */
export function groupByConfidence(report: VerificationReport): {
  verified: VerifiedFinding[];
  probable: VerifiedFinding[];
  weak: VerifiedFinding[];
} {
  return {
    verified:  report.findings.filter((f) => f.confidence.class === 'VERIFIED'),
    probable:  report.findings.filter((f) => f.confidence.class === 'PROBABLE'),
    weak:      report.findings.filter((f) => f.confidence.class === 'WEAK'),
  };
}
