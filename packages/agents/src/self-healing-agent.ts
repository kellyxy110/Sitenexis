import type {
  HealingAction,
  SelfHealingPlan,
  VerificationReport,
  VerifiedFinding,
  SEOIssueSeverity,
} from '@sitenexis/shared';
import { generateFix } from '@sitenexis/analyzers';
import type { IssueContext } from '@sitenexis/analyzers';

// ── Priority scoring ──────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<SEOIssueSeverity, number> = {
  critical: 3,
  warning:  2,
  info:     1,
};

const IMPACT_WEIGHT: Record<'high' | 'medium' | 'low', number> = {
  high:   1.0,
  medium: 0.6,
  low:    0.3,
};

function computePriority(finding: VerifiedFinding): number {
  const severityWeight =
    finding.adjustedSeverity === 'suppressed'
      ? 0
      : SEVERITY_WEIGHT[finding.adjustedSeverity as SEOIssueSeverity] ?? 1;

  return Math.round(severityWeight * finding.confidence.value * 100) / 100;
}

// ── Finding → IssueContext bridge ─────────────────────────────────────────────

function toIssueContext(
  finding: VerifiedFinding,
  auditId: string,
  domain: string,
): IssueContext {
  return {
    issueId:        finding.findingId,
    auditId,
    type:           finding.issueType,
    severity:       finding.adjustedSeverity === 'suppressed' ? 'info' : finding.adjustedSeverity,
    message:        finding.description,
    recommendation: finding.recommendation,
    ...(finding.pageUrl !== null ? { pageUrl: finding.pageUrl } : {}),
    module:         finding.category,
    domain,
  };
}

// ── Score gain estimation ─────────────────────────────────────────────────────
// Rough heuristic: each critical fix = 8 pts, warning = 3 pts, info = 1 pt
// weighted by expected impact and confidence.

function estimateScoreGain(actions: HealingAction[]): number {
  const BASE: Record<SEOIssueSeverity, number> = { critical: 8, warning: 3, info: 1 };
  let gain = 0;
  for (const action of actions) {
    const sev: SEOIssueSeverity =
      action.priority >= 2.5 ? 'critical' : action.priority >= 1.5 ? 'warning' : 'info';
    gain += BASE[sev] * IMPACT_WEIGHT[action.expectedImpact] * action.confidence.value;
  }
  return Math.min(100, Math.round(gain));
}

// ── Main agent ────────────────────────────────────────────────────────────────

export interface SelfHealingAgentOptions {
  domain: string;
  /** Only surface findings with confidence ≥ this threshold. Default: 0.7 (PROBABLE+) */
  minConfidence?: number;
  /** Skip LLM fix generation and use templates only. Default: false */
  templatesOnly?: boolean;
  groqApiKey?: string;
}

/**
 * Self-Healing Agent — Suggestion Mode Only.
 *
 * Takes a VerificationReport and produces a prioritised SelfHealingPlan.
 * Every action is a concrete, ready-to-apply fix suggestion. No changes
 * are deployed automatically — the plan requires human review.
 *
 * Findings below `minConfidence` (default 0.7) are excluded. Suppressed
 * findings (confidence < 0.5) are always excluded.
 */
export async function runSelfHealingAgent(
  auditId: string,
  verificationReport: VerificationReport,
  options: SelfHealingAgentOptions,
): Promise<SelfHealingPlan> {
  const { domain, minConfidence = 0.7, templatesOnly = false, groqApiKey } = options;

  // Filter: only actionable findings with sufficient confidence
  const actionable = verificationReport.findings.filter(
    (f) =>
      f.adjustedSeverity !== 'suppressed' &&
      f.confidence.value >= minConfidence,
  );

  // Generate fixes concurrently (max 5 at once to respect API rate limits)
  const actions: HealingAction[] = [];
  const BATCH = 5;

  for (let i = 0; i < actionable.length; i += BATCH) {
    const batch = actionable.slice(i, i + BATCH);

    const batchResults = await Promise.allSettled(
      batch.map(async (finding): Promise<HealingAction> => {
        const ctx = toIssueContext(finding, auditId, domain);
        const fix = await generateFix(ctx, templatesOnly ? {} : groqApiKey ? { groqApiKey } : {});

        return {
          id:             `ha_${finding.findingId}`,
          findingId:      finding.findingId,
          issueType:      finding.issueType,
          title:          buildActionTitle(finding),
          priority:       computePriority(finding),
          confidence:     finding.confidence,
          affectedUrl:    finding.pageUrl,
          category:       finding.category,
          problem:        fix.problem,
          solution:       fix.solution,
          fixCode:        fix.fixCode,
          fixLanguage:    fix.fixLanguage,
          expectedImpact: fix.expectedImpact,
          effort:         fix.effort,
          fixSource:      fix.source,
        };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        actions.push(result.value);
      }
      // Rejected: log and skip — partial failure is acceptable
    }
  }

  // Sort: highest priority first; break ties by effort (low effort first)
  actions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const effortOrder = { low: 0, medium: 1, high: 2 };
    return effortOrder[a.effort] - effortOrder[b.effort];
  });

  const criticalActions = actions.filter((a) => a.priority >= 2.5).length;
  const warningActions  = actions.filter((a) => a.priority >= 1.5 && a.priority < 2.5).length;

  return {
    auditId,
    generatedAt:        new Date(),
    totalActions:       actions.length,
    criticalActions,
    warningActions,
    estimatedScoreGain: estimateScoreGain(actions),
    actions,
    disclaimer:
      'All suggestions require manual review and testing before deployment. ' +
      'SiteNexis does not modify your website directly.',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildActionTitle(finding: VerifiedFinding): string {
  const type = finding.issueType.replace(/_/g, ' ');
  const confidence = finding.confidence.class;
  return `[${confidence}] ${capitalise(type)}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
