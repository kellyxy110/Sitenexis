import type {
  FixPlan,
  FixPlanItem,
  FixPlanModuleBreakdown,
  SEOIssueSeverity,
  GTLState,
  TrustIssue,
  TemporalIssue,
  RetrievalFailure,
  CoverageGap,
  SyntheticPattern,
} from '@sitenexis/shared';
import {
  assignPriority,
  computeImpactScores,
  estimateEffort,
  estimateEffortHours,
  computeExpectedImpact,
} from './priorities';
import { applyDependencies, buildDependencyChains } from './dependencies';

export interface IssueRecord {
  id: string;
  module: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  recommendation: string;
  pageUrl: string | null;
  problem: string | null;
  solution: string | null;
  fixCode: string | null;
  fixLanguage: string | null;
}

export interface SubReportIssues {
  trustIssues?: TrustIssue[];
  temporalIssues?: TemporalIssue[];
  retrievalFailures?: RetrievalFailure[];
  coverageGaps?: CoverageGap[];
  syntheticPatterns?: SyntheticPattern[];
}

export interface FixPlanInput {
  domain: string;
  issues: IssueRecord[];
  subReportIssues: SubReportIssues;
}

export function buildFixPlan(input: FixPlanInput): FixPlan {
  const { domain, issues, subReportIssues } = input;
  const timestamp = new Date().toISOString();

  // ── Step 1: Normalize all issues into FixPlanItems ────────────────────────
  const rawItems: FixPlanItem[] = [];

  // From Issues table
  for (const issue of issues) {
    const impactScores = computeImpactScores(issue.severity, issue.module, issue.type);
    const effort = estimateEffort(issue.module, issue.type, !!issue.fixCode);
    const expectedImpact = computeExpectedImpact(issue.severity, impactScores);
    const priority = assignPriority(issue.severity, issue.module, impactScores);

    rawItems.push({
      id: issue.id,
      priority,
      module: issue.module,
      type: issue.type,
      severity: issue.severity,
      pageUrl: issue.pageUrl,
      message: issue.message,
      recommendation: issue.recommendation,
      problem: issue.problem,
      solution: issue.solution,
      fixCode: issue.fixCode,
      fixLanguage: issue.fixLanguage,
      expectedImpact,
      effort,
      dependsOn: [],
      impactScores,
    });
  }

  // From sub-report: Trust Issues
  if (subReportIssues.trustIssues) {
    for (const ti of subReportIssues.trustIssues) {
      const severity = normalizeSeverity(ti.severity);
      const impactScores = computeImpactScores(severity, 'machine-trust', ti.type);
      const effort = estimateEffort('machine-trust', ti.type, false);
      const expectedImpact = computeExpectedImpact(severity, impactScores);
      const priority = assignPriority(severity, 'machine-trust', impactScores);

      rawItems.push({
        id: `trust-${ti.entity}-${ti.type}`,
        priority, module: 'machine-trust', type: ti.type, severity,
        pageUrl: null, message: ti.description, recommendation: ti.recommendation,
        problem: null, solution: null, fixCode: null, fixLanguage: null,
        expectedImpact, effort, dependsOn: [], impactScores,
      });
    }
  }

  // From sub-report: Temporal Issues
  if (subReportIssues.temporalIssues) {
    for (const ti of subReportIssues.temporalIssues) {
      const severity = normalizeSeverity(ti.severity);
      const impactScores = computeImpactScores(severity, 'temporal-authority', ti.type);
      const effort = estimateEffort('temporal-authority', ti.type, false);
      const expectedImpact = computeExpectedImpact(severity, impactScores);
      const priority = assignPriority(severity, 'temporal-authority', impactScores);

      rawItems.push({
        id: `temporal-${ti.pageUrl}-${ti.type}`,
        priority, module: 'temporal-authority', type: ti.type, severity,
        pageUrl: ti.pageUrl, message: ti.description, recommendation: ti.recommendation,
        problem: null, solution: null, fixCode: null, fixLanguage: null,
        expectedImpact, effort, dependsOn: [], impactScores,
      });
    }
  }

  // From sub-report: Retrieval Failures
  if (subReportIssues.retrievalFailures) {
    for (const rf of subReportIssues.retrievalFailures) {
      const severity = normalizeSeverity(rf.severity);
      const impactScores = computeImpactScores(severity, 'retrieval-simulation', rf.stage);
      const effort = estimateEffort('retrieval-simulation', rf.stage, false);
      const expectedImpact = computeExpectedImpact(severity, impactScores);
      const priority = assignPriority(severity, 'retrieval-simulation', impactScores);

      rawItems.push({
        id: `retrieval-${rf.stage}-${rawItems.length}`,
        priority, module: 'retrieval-simulation', type: rf.stage, severity,
        pageUrl: null, message: rf.description, recommendation: rf.recommendation,
        problem: null, solution: null, fixCode: null, fixLanguage: null,
        expectedImpact, effort, dependsOn: [], impactScores,
      });
    }
  }

  // From sub-report: Coverage Gaps
  if (subReportIssues.coverageGaps) {
    for (const cg of subReportIssues.coverageGaps) {
      const severity: SEOIssueSeverity = cg.estimatedImpact === 'high' ? 'critical' : cg.estimatedImpact === 'medium' ? 'warning' : 'info';
      const impactScores = computeImpactScores(severity, 'recommendation-surface', 'coverage_gap');
      const effort = estimateEffort('recommendation-surface', 'coverage_gap', false);
      const expectedImpact = computeExpectedImpact(severity, impactScores);
      const priority = assignPriority(severity, 'recommendation-surface', impactScores);

      rawItems.push({
        id: `surface-${cg.surface}-${rawItems.length}`,
        priority, module: 'recommendation-surface', type: 'coverage_gap', severity,
        pageUrl: null, message: `${cg.surface}: ${cg.missedOpportunity}`,
        recommendation: `Add required signals: ${cg.requiredSignals.join(', ')}`,
        problem: null, solution: null, fixCode: null, fixLanguage: null,
        expectedImpact, effort, dependsOn: [], impactScores,
      });
    }
  }

  // From sub-report: Synthetic Patterns
  if (subReportIssues.syntheticPatterns) {
    for (const sp of subReportIssues.syntheticPatterns) {
      const severity = normalizeSeverity(sp.severity);
      const impactScores = computeImpactScores(severity, 'synthetic-entity', sp.patternType);
      const effort = estimateEffort('synthetic-entity', sp.patternType, false);
      const expectedImpact = computeExpectedImpact(severity, impactScores);
      const priority = assignPriority(severity, 'synthetic-entity', impactScores);

      rawItems.push({
        id: `synthetic-${sp.patternType}-${rawItems.length}`,
        priority, module: 'synthetic-entity', type: sp.patternType, severity,
        pageUrl: null, message: `Synthetic pattern detected: ${sp.patternType.replace(/_/g, ' ')}`,
        recommendation: sp.evidence.length > 0 ? `Investigate: ${sp.evidence[0]}` : 'Review entity authenticity signals',
        problem: null, solution: null, fixCode: null, fixLanguage: null,
        expectedImpact, effort, dependsOn: [], impactScores,
      });
    }
  }

  // ── Step 1b: Collapse duplicate actions ───────────────────────────────────
  // The Issues table can carry the same fix across many pages (e.g. missing alt
  // text on 40 URLs). Emitting one action per row produces a repetitive plan, so
  // collapse by (module, type, recommendation), keep the most-severe representative,
  // and record how many pages the fix spans.
  const items = dedupeItems(rawItems);

  // ── Step 2: Apply dependency mapping ──────────────────────────────────────
  applyDependencies(items);

  // ── Step 3: Sort by priority, then severity, then impact ─────────────────
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

  items.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    const sDiff = (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2);
    if (sDiff !== 0) return sDiff;
    const aTotal = a.impactScores.seoImpact + a.impactScores.aiVisibilityImpact + a.impactScores.trustImpact;
    const bTotal = b.impactScores.seoImpact + b.impactScores.aiVisibilityImpact + b.impactScores.trustImpact;
    return bTotal - aTotal;
  });

  // ── Step 4: Compute aggregates ────────────────────────────────────────────
  const p0Count = items.filter((i) => i.priority === 'P0').length;
  const p1Count = items.filter((i) => i.priority === 'P1').length;
  const p2Count = items.filter((i) => i.priority === 'P2').length;

  const moduleBreakdown = computeModuleBreakdown(items);
  const dependencyChains = buildDependencyChains(items);

  const estimatedTotalEffortHours = items.reduce(
    (sum, item) => sum + estimateEffortHours(item.effort), 0
  );

  const overallFixScore = computeOverallFixScore(items);

  const state: GTLState = items.length === 0 ? 'empty' : 'complete';

  return {
    state,
    timestamp,
    domain,
    totalItems: items.length,
    p0Count, p1Count, p2Count,
    overallFixScore,
    estimatedTotalEffortHours: Math.round(estimatedTotalEffortHours * 10) / 10,
    items,
    dependencyChains,
    moduleBreakdown,
  };
}

function computeModuleBreakdown(items: FixPlanItem[]): FixPlanModuleBreakdown[] {
  const modules = new Map<string, FixPlanModuleBreakdown>();

  for (const item of items) {
    if (!modules.has(item.module)) {
      modules.set(item.module, { module: item.module, count: 0, p0: 0, p1: 0, p2: 0 });
    }
    const m = modules.get(item.module)!;
    m.count++;
    if (item.priority === 'P0') m.p0++;
    else if (item.priority === 'P1') m.p1++;
    else m.p2++;
  }

  return Array.from(modules.values()).sort((a, b) => b.p0 - a.p0 || b.count - a.count);
}

function computeOverallFixScore(items: FixPlanItem[]): number {
  if (items.length === 0) return 100;

  let totalImpact = 0;
  for (const item of items) {
    const weight = item.priority === 'P0' ? 3 : item.priority === 'P1' ? 2 : 1;
    const impact = item.impactScores.seoImpact + item.impactScores.aiVisibilityImpact + item.impactScores.trustImpact;
    totalImpact += weight * impact;
  }

  const maxPossibleImpact = items.length * 3 * 27;
  const impactRatio = totalImpact / maxPossibleImpact;

  return Math.max(0, Math.min(100, Math.round((1 - impactRatio) * 100)));
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Collapse duplicate fix actions. Two items are "the same fix" when they share a
 * module, type, and (normalized) recommendation — regardless of which page raised
 * them. The representative kept is the most severe; on a tie, the one carrying a
 * code fix. When a fix spans multiple pages, its message notes the page count so
 * the coverage information is preserved rather than lost.
 */
function dedupeItems(items: FixPlanItem[]): FixPlanItem[] {
  const groups = new Map<string, FixPlanItem[]>();
  for (const item of items) {
    const actionText = (item.recommendation || item.message).trim().toLowerCase().replace(/\s+/g, ' ');
    const sig = `${item.module}::${item.type}::${actionText}`;
    const group = groups.get(sig);
    if (group) group.push(item);
    else groups.set(sig, [item]);
  }

  const result: FixPlanItem[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }
    const rep = [...group].sort((a, b) =>
      ((SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2))
      || ((a.fixCode ? 0 : 1) - (b.fixCode ? 0 : 1)),
    )[0]!;
    const affectedPages = new Set(group.map((i) => i.pageUrl).filter((u): u is string => !!u)).size;
    result.push(
      affectedPages > 1
        ? { ...rep, message: `${rep.message} (affects ${affectedPages} pages)` }
        : rep,
    );
  }
  return result;
}

function normalizeSeverity(severity: string): SEOIssueSeverity {
  if (severity === 'critical' || severity === 'warning' || severity === 'info') {
    return severity;
  }
  return 'warning';
}
