import { env } from '@/lib/env';
import { resolveAuditForDomain, type ResolvedDomainAudit } from '@/lib/audit-intelligence/domain-lookup';
import { getAuditScorecard } from '@/lib/audit-intelligence/scorecard';
import { getExecutiveSummary } from '@/lib/audit-intelligence/executive-summary-service';
import { getNarrativeReport } from '@/lib/audit-intelligence/narrative-report-service';
import { getAuditIssueSummary } from '@/lib/audit-intelligence/issues';
import { getAuditFixPlan } from '@/lib/audit-intelligence/recommendations';
import { getAuditEvidenceSummary } from '@/lib/audit-intelligence/evidence';
import { escapeHtml, fmtTime, runCommand } from './commands';

/**
 * Every /audit-family command starts the same way: parse the domain arg and
 * resolve it to the latest usable audit, producing a truthful message for
 * every non-"found a usable audit" outcome. Called *inside* runCommand's
 * wrapped fn (not before it) so the domain-lookup DB queries are covered by
 * the same 8s timeout as the rest of the command — an unresolvable lookup
 * must degrade the same way a slow scorecard query would.
 */
async function resolveOrExplain(args: string[], title: string): Promise<{ resolved: ResolvedDomainAudit; auditId: string } | string> {
  const rawDomain = args[0];
  if (!rawDomain) return `<b>${title}</b>\nUsage: /${title.toLowerCase()} &lt;domain&gt;`;

  const resolved = await resolveAuditForDomain(rawDomain);
  if (!resolved) return `<b>${title}</b>\n"${escapeHtml(rawDomain)}" is not a valid domain.`;

  const domain = escapeHtml(resolved.domain);

  if (!resolved.audit) {
    if (!resolved.hadAnyAuditHistory) {
      return `<b>${title}</b>\nNo SiteNexis audits found for ${domain}.`;
    }
    const status = resolved.latestAnyStatus;
    if (status === 'queued' || status === 'running') {
      return `<b>${title}</b>\nAn audit for ${domain} is currently ${status}. No completed SiteNexis audit is available for ${domain} yet.`;
    }
    if (status === 'failed') {
      return `<b>${title}</b>\nThe most recent SiteNexis audit for ${domain} failed. No completed SiteNexis audit is available for ${domain}.`;
    }
    return `<b>${title}</b>\nNo completed SiteNexis audit is available for ${domain}.`;
  }

  return { resolved, auditId: resolved.audit.id };
}

function partialBanner(isPartial: boolean): string {
  return isPartial ? '⚠️ <b>PARTIAL AUDIT</b> — some scores/evidence below may be unavailable, not zero.\n' : '';
}

function fmtScore(value: number | undefined | null, suffix = '/100'): string {
  return value === undefined || value === null ? 'unavailable' : `${Math.round(value)}${suffix}`;
}

function dashboardLink(domain: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/audit/${domain}`;
}

function shortAuditId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function formatScoreBlock(title: string, values: Record<string, number> | null): string {
  if (!values) return `\n<b>${title}</b>\nunavailable`;
  const rows = Object.entries(values).map(([k, v]) => `${k}: ${fmtScore(v)}`);
  return `\n<b>${title}</b>\n${rows.join('\n')}`;
}

/** /audit <domain> — executive intelligence summary. */
export async function commandAudit(args: string[]): Promise<string> {
  return runCommand('audit', 'SiteNexis Intelligence Report', async () => {
    const outcome = await resolveOrExplain(args, 'Audit');
    if (typeof outcome === 'string') return outcome;
    const { resolved, auditId } = outcome;

    const [scorecard, summary] = await Promise.all([
      getAuditScorecard(auditId),
      getExecutiveSummary(auditId),
    ]);
    if (!scorecard) return `<b>SiteNexis Intelligence Report</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [
      '<b>SiteNexis Intelligence Report</b>',
      escapeHtml(resolved.domain),
      '',
      partialBanner(resolved.isPartial),
    ].filter((l) => l !== '');

    if (summary?.data) {
      lines.push('<b>Overall Assessment</b>');
      lines.push(`${summary.data.composite_score.toFixed(1)}/10 — ${escapeHtml(summary.data.composite_label)}`);
      lines.push('');
    }

    lines.push('<b>Scores</b>');
    if (scorecard.v2) {
      lines.push(`AI Visibility: ${fmtScore(scorecard.v2.aiVisibilityScore)}`);
      lines.push(`Retrieval Readiness: ${fmtScore(scorecard.v2.retrievalReadinessScore)}`);
      lines.push(`Citation Probability: ${fmtScore(scorecard.v2.citationProbabilityScore)}`);
      lines.push(`Semantic Trust: ${fmtScore(scorecard.v2.semanticTrustScore)}`);
      lines.push(`Entity Confidence: ${fmtScore(scorecard.v2.entityConfidenceScore)}`);
    }
    if (scorecard.machineTrust) lines.push(`Machine Trust: ${fmtScore(scorecard.machineTrust.overall)}`);
    if (scorecard.v1) lines.push(`Technical SEO: ${fmtScore(scorecard.v1.seoScore)}`);
    if (!scorecard.v1 && !scorecard.v2) lines.push('No canonical scores recorded yet.');
    lines.push('');
    lines.push(`Scoring model: ${escapeHtml(scorecard.scoringModelLabel)}`);
    lines.push(`Generated: ${fmtTime(new Date())}`);
    lines.push(`Audit ID: ${shortAuditId(auditId)}`);

    if (summary?.data) {
      lines.push('');
      lines.push('<b>Executive Assessment</b>');
      lines.push(escapeHtml(summary.data.overall_verdict));

      const findings = summary.data.sections
        .flatMap((s) => s.issues.map((issue) => `${s.name}: ${issue}`))
        .slice(0, 5);
      if (findings.length > 0) {
        lines.push('');
        lines.push('<b>Key Findings</b>');
        findings.forEach((f, i) => lines.push(`${i + 1}. ${escapeHtml(f)}`));
      }

      if (summary.data.top_recommendations[0]) {
        lines.push('');
        lines.push('<b>Priority</b>');
        lines.push(escapeHtml(summary.data.top_recommendations[0]));
      }
    } else {
      lines.push('');
      lines.push('<i>The audit scores and evidence above are available, but the prose Intelligence Report is not currently available. View the full SiteNexis report or regenerate it through the canonical report workflow.</i>');
    }

    lines.push('');
    lines.push(`View full report: ${dashboardLink(resolved.domain)}`);
    lines.push('More: /scores /issues /recommendations /evidence /report');

    return lines.join('\n');
  });
}

/** /scores <domain> — full canonical scorecard, every tier that exists for this audit. */
export async function commandScores(args: string[]): Promise<string> {
  return runCommand('scores', 'Scores', async () => {
    const outcome = await resolveOrExplain(args, 'Scores');
    if (typeof outcome === 'string') return outcome;
    const { resolved, auditId } = outcome;

    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Scores</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Scores</b> — ${escapeHtml(resolved.domain)}`, partialBanner(resolved.isPartial)].filter((l) => l !== '');

    lines.push(formatScoreBlock('V1 — Technical SEO', scorecard.v1 ? {
      Overall: scorecard.v1.overall, 'SEO Score': scorecard.v1.seoScore, 'AI Score': scorecard.v1.aiScore,
      Schema: scorecard.v1.schemaScore, 'Link Graph': scorecard.v1.linkGraphScore, Performance: scorecard.v1.performanceScore,
    } : null));

    lines.push(formatScoreBlock('V2 — AI Visibility', scorecard.v2 ? {
      'AI Visibility': scorecard.v2.aiVisibilityScore, 'Machine Readability': scorecard.v2.machineReadabilityScore,
      'Entity Confidence': scorecard.v2.entityConfidenceScore, 'Retrieval Readiness': scorecard.v2.retrievalReadinessScore,
      'Citation Probability': scorecard.v2.citationProbabilityScore, 'Semantic Trust': scorecard.v2.semanticTrustScore,
      'Recommendation Confidence': scorecard.v2.recommendationConfidence,
    } : null));

    lines.push(formatScoreBlock('Layer 4 — Machine Trust', scorecard.machineTrust ? {
      Overall: scorecard.machineTrust.overall, 'Entity Credibility': scorecard.machineTrust.entityCredibilityScore,
      'Schema Trust Alignment': scorecard.machineTrust.schemaTrustAlignmentScore,
      'External Validation': scorecard.machineTrust.externalValidationScore,
      ...(scorecard.machineTrust.contradictionAbsenceScore !== null ? { 'Contradiction Absence': scorecard.machineTrust.contradictionAbsenceScore } : {}),
    } : null));

    if (scorecard.sii) {
      lines.push(formatScoreBlock('SII — Composite Index', { Score: scorecard.sii.score, Confidence: Math.round(scorecard.sii.confidence * 100) }));
    }

    lines.push(`\nScoring model: ${escapeHtml(scorecard.scoringModelLabel)}`);
    return lines.join('\n');
  });
}

/** /issues <domain> — canonical, deduplicated, severity-grouped issue list. */
export async function commandIssues(args: string[]): Promise<string> {
  return runCommand('issues', 'Issues', async () => {
    const outcome = await resolveOrExplain(args, 'Issues');
    if (typeof outcome === 'string') return outcome;
    const { resolved, auditId } = outcome;

    const summary = await getAuditIssueSummary(auditId);
    if (!summary) return `<b>Issues</b>\nAudit found, but issue data is unavailable.`;

    const lines: string[] = [`<b>Issues</b> — ${escapeHtml(resolved.domain)}`, partialBanner(resolved.isPartial)].filter((l) => l !== '');

    const section = (label: string, items: typeof summary.critical, max: number) => {
      lines.push(`\n<b>${label}</b>`);
      if (items.length === 0) { lines.push('None'); return; }
      items.slice(0, max).forEach((it) => lines.push(`• ${escapeHtml(it.message)}`));
      if (items.length > max) lines.push(`…and ${items.length - max} more. See the SiteNexis dashboard.`);
    };

    section('CRITICAL', summary.critical, 8);
    section('WARNING', summary.warning, 5);
    section('INFO', summary.info, 3);

    lines.push(`\nView full list: ${dashboardLink(resolved.domain)}`);
    return lines.join('\n');
  });
}

/** /recommendations <domain> — canonical Fix Plan, priority-ordered. */
export async function commandRecommendations(args: string[]): Promise<string> {
  return runCommand('recommendations', 'Recommendations', async () => {
    const outcome = await resolveOrExplain(args, 'Recommendations');
    if (typeof outcome === 'string') return outcome;
    const { resolved, auditId } = outcome;

    const fixPlan = await getAuditFixPlan(auditId);
    if (!fixPlan) return `<b>Recommendations</b>\nAudit found, but recommendation data is unavailable.`;
    if (fixPlan.items.length === 0) return `<b>Recommendations</b> — ${escapeHtml(resolved.domain)}\nNo outstanding recommendations.`;

    const lines: string[] = [`<b>Recommendations</b> — ${escapeHtml(resolved.domain)}`, partialBanner(resolved.isPartial)].filter((l) => l !== '');

    const byPriority = (label: string, priority: 'P0' | 'P1' | 'P2', max: number) => {
      const items = fixPlan.items.filter((i) => i.priority === priority);
      if (items.length === 0) return;
      lines.push(`\n<b>${label}</b>`);
      items.slice(0, max).forEach((it) => {
        lines.push(`• ${escapeHtml(it.message)}`);
        lines.push(`  → ${escapeHtml(it.recommendation)}`);
      });
      if (items.length > max) lines.push(`…and ${items.length - max} more.`);
    };

    byPriority('P0 — Immediate', 'P0', 5);
    byPriority('P1 — High Priority', 'P1', 3);
    byPriority('P2 — Improvement', 'P2', 2);

    lines.push(`\nFix score: ${fixPlan.overallFixScore}/100 · Est. effort: ${fixPlan.estimatedTotalEffortHours}h`);
    lines.push(`View full roadmap: ${dashboardLink(resolved.domain)}`);
    return lines.join('\n');
  });
}

/** /evidence <domain> — compact crawl/schema/indexability evidence summary. */
export async function commandEvidence(args: string[]): Promise<string> {
  return runCommand('evidence', 'Evidence', async () => {
    const outcome = await resolveOrExplain(args, 'Evidence');
    if (typeof outcome === 'string') return outcome;
    const { resolved, auditId } = outcome;

    const evidence = await getAuditEvidenceSummary(auditId);
    if (!evidence) return `<b>Evidence</b>\nAudit found, but evidence data is unavailable.`;

    const lines: string[] = [`<b>Evidence</b> — ${escapeHtml(resolved.domain)}`, partialBanner(resolved.isPartial)].filter((l) => l !== '');

    lines.push(`\n<b>Crawl Evidence</b>`);
    lines.push(`Pages crawled: ${evidence.pageCount}`);
    if (evidence.homepage) {
      lines.push(`Homepage: ${evidence.homepage.statusCode}`);
      lines.push(`Robots directive: ${evidence.homepage.robotsDirective ? escapeHtml(evidence.homepage.robotsDirective) : 'not detected'}`);
      lines.push(`Canonical: ${evidence.homepage.canonicalUrl ? escapeHtml(evidence.homepage.canonicalUrl) : 'not detected'}`);
      lines.push(`H1: ${evidence.homepage.h1 ? escapeHtml(evidence.homepage.h1) : 'not detected'}`);
    } else {
      lines.push('Homepage: not available');
    }

    lines.push(`\n<b>Indexability</b>`);
    lines.push(`Indexable: ${evidence.indexability.indexablePages}/${evidence.pageCount}`);
    lines.push(`Missing canonical: ${evidence.canonicalIssues.missingCanonical}`);
    lines.push(`Invalid canonical: ${evidence.canonicalIssues.invalidCanonical}`);

    lines.push(`\n<b>Structured Data</b>`);
    lines.push(`Pages with schema: ${evidence.schemaCoverage.pagesWithSchema}/${evidence.pageCount}`);
    lines.push(evidence.schemaCoverage.distinctSchemaTypes.length > 0
      ? `Types detected: ${evidence.schemaCoverage.distinctSchemaTypes.map(escapeHtml).join(', ')}`
      : 'Types detected: none');

    lines.push(`\n<b>Entities</b>`);
    lines.push(`Primary entity: ${evidence.entities.primaryEntityName ? escapeHtml(evidence.entities.primaryEntityName) : 'not detected'}`);
    lines.push(`sameAs links: ${evidence.entities.sameAsLinksCount}`);

    return lines.join('\n');
  });
}

/** /report <domain> — expanded prose Intelligence Report, chunked for Telegram. */
export async function commandReport(args: string[]): Promise<string> {
  return runCommand('report', 'Intelligence Report', async () => {
    const outcome = await resolveOrExplain(args, 'Report');
    if (typeof outcome === 'string') return outcome;
    const { resolved, auditId } = outcome;

    const report = await getNarrativeReport(auditId);
    if (!report?.data) {
      return [
        `<b>Intelligence Report</b> — ${escapeHtml(resolved.domain)}`,
        'The prose Intelligence Report is not currently available. Scores, issues, recommendations, and evidence remain available via /scores, /issues, /recommendations, /evidence.',
        `View the full report or regenerate it: ${dashboardLink(resolved.domain)}`,
      ].join('\n');
    }

    const lines: string[] = [`<b>Intelligence Report</b> — ${escapeHtml(resolved.domain)}`, partialBanner(resolved.isPartial)].filter((l) => l !== '');

    const data = report.data;
    const summary = typeof data.summary === 'string' ? data.summary : (typeof data.overview === 'string' ? data.overview : null);
    if (summary) lines.push(escapeHtml(summary));

    const sections = Array.isArray(data.sections) ? data.sections as Array<Record<string, unknown>> : [];
    for (const section of sections.slice(0, 6)) {
      const name = typeof section.name === 'string' ? section.name : (typeof section.title === 'string' ? section.title : null);
      const narrative = typeof section.narrative === 'string' ? section.narrative : (typeof section.content === 'string' ? section.content : null);
      if (name) lines.push(`\n<b>${escapeHtml(name)}</b>`);
      if (narrative) lines.push(escapeHtml(narrative));
    }

    lines.push(`\nThis is an executive excerpt. Full report: ${dashboardLink(resolved.domain)}`);
    return lines.join('\n');
  });
}
