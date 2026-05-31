import type {
  CrawledPage,
  EntityIntelligenceReport,
  SchemaScore,
  MachineTrustScore,
  TrustIssue,
  TrustDegradationSignal,
} from '@sitenexis/shared';
import { analyseEntityCredibility } from './credibility';
import { detectContradictions } from './contradiction';
import { analyseExternalValidation } from './validation';
import { analyseTrustDecay } from './decay';

export { analyseEntityCredibility } from './credibility';
export { detectContradictions } from './contradiction';
export { analyseExternalValidation } from './validation';
export { analyseTrustDecay } from './decay';

// ─── Schema trust alignment ───────────────────────────────────────────────────

/**
 * Measures whether schema markup accurately describes page content without
 * embellishment. Fully programmatic — no AI API calls.
 *
 * Formula sub-component of Machine Trust Score (CLAUDE.md §23).
 */
function scoreSchemaTrustAlignment(
  pages: CrawledPage[],
  schema: SchemaScore,
): { score: number; issues: TrustIssue[] } {
  const issues: TrustIssue[] = [];
  let penaltyTotal = 0;

  // Base: use schema completeness score as starting point
  // A higher completeness score means more is claimed — need to verify it's accurate
  const schemaBase = schema.score;

  // Pages with schema types not evidenced in body text
  for (const pageAnalysis of schema.pageAnalyses) {
    const page = pages.find((p) => p.url === pageAnalysis.url);
    if (!page) continue;

    for (const schemaType of pageAnalysis.detectedTypes) {
      // Check for obvious type mismatches
      if (schemaType === 'FAQPage' && !hasFaqContent(page)) {
        penaltyTotal += 8;
        issues.push({
          type: 'schema_overclaim_faq',
          severity: 'warning',
          entity: page.url,
          description: `FAQPage schema on ${page.url} but no Q&A pattern detected in body text.`,
          recommendation: 'Only apply FAQPage schema to pages containing explicit question-and-answer content.',
        });
      }

      if (schemaType === 'HowTo' && !hasHowToContent(page)) {
        penaltyTotal += 8;
        issues.push({
          type: 'schema_overclaim_howto',
          severity: 'warning',
          entity: page.url,
          description: `HowTo schema on ${page.url} but no step-by-step content detected.`,
          recommendation: 'Only apply HowTo schema to pages with numbered instructions.',
        });
      }
    }
  }

  const score = Math.max(0, Math.round(schemaBase - penaltyTotal));
  return { score, issues };
}

function hasFaqContent(page: CrawledPage): boolean {
  const text = page.bodyText ?? '';
  return /\b(q:|question:|a:|answer:|faq|frequently asked)\b/i.test(text)
    || (text.match(/\?/g) ?? []).length >= 3;
}

function hasHowToContent(page: CrawledPage): boolean {
  const text = page.bodyText ?? '';
  return /\bstep\s+\d+\b/i.test(text)
    || /^\d+\.\s+[A-Z]/m.test(text)
    || (text.match(/^[-•]\s+/m) ?? []).length >= 3;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Runs the full Machine Trust analysis.
 *
 * Machine Trust Score formula (CLAUDE.md §23):
 *   Entity Credibility Consistency   × 0.30
 *   + Schema Trust Alignment         × 0.20
 *   + External Validation Depth      × 0.25
 *   + Contradiction Absence Score    × 0.15
 *   + Trust Degradation Resistance   × 0.10
 *
 * @param pages           - Crawled pages for this audit
 * @param entityReport    - Output from entity analyzer
 * @param schema          - Output from schema analyzer
 * @param priorSchemaUrls - URLs that had schema in the previous audit (optional — skip decay delta on first audit)
 * @param semanticContradictionAbsenceScore - Result from Claude API contradiction detection on top 20 pages.
 *                                            Pass null if Claude API was unavailable.
 */
export function runMachineTrustAnalysis(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
  schema: SchemaScore,
  priorSchemaUrls?: string[],
  semanticContradictionAbsenceScore?: number | null,
): MachineTrustScore {
  const credibility = analyseEntityCredibility(pages, entityReport);
  const schemaTrust = scoreSchemaTrustAlignment(pages, schema);
  const validation = analyseExternalValidation(pages, entityReport);
  const decay = analyseTrustDecay(pages, priorSchemaUrls);
  const contradiction = detectContradictions(pages, entityReport);

  // Use Claude API result if available, else fall back to programmatic score
  const contradictionAbsenceScore: number | null =
    semanticContradictionAbsenceScore ?? contradiction.score;

  // Compute overall score
  // Contradiction uses programmatic score if Claude result is null
  const programmingContradictionScore = contradiction.score;
  const finalContradictionScore = semanticContradictionAbsenceScore ?? programmingContradictionScore;

  const overall = Math.round(
    credibility.score * 0.30
    + schemaTrust.score * 0.20
    + validation.score * 0.25
    + finalContradictionScore * 0.15
    + decay.score * 0.10,
  );

  const allIssues: TrustIssue[] = [
    ...credibility.issues,
    ...schemaTrust.issues,
    ...validation.issues,
    ...contradiction.issues,
    ...decay.issues,
  ];

  const allDegradationSignals: TrustDegradationSignal[] = decay.degradationSignals;

  return {
    overall: Math.min(100, overall),
    entityCredibilityScore: credibility.score,
    schemaTrustAlignmentScore: schemaTrust.score,
    externalValidationScore: validation.score,
    contradictionAbsenceScore,
    trustDegradationResistance: decay.score,
    trustIssues: allIssues,
    degradationSignals: allDegradationSignals,
    crossSourceValidationIndex: validation.crossSourceValidationIndex,
  };
}
