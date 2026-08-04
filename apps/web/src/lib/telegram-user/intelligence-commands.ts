/**
 * Telegram User Assistant — canonical intelligence commands (T4).
 *
 * Every command here reads already-computed data through the same
 * canonical services used by the dashboard and the Telegram Ops bot
 * (`@/lib/audit-intelligence/*`) — no score is calculated, and no
 * recommendation prose is generated, in this file. All commands resolve
 * strictly against the CALLING user's own linked account and their own
 * `activeDomain`; there is no domain argument, so there is no surface for
 * one user to probe another user's audit by guessing a domain string.
 *
 * Zero LLM calls happen anywhere in this file. /report reads the durable
 * `AuditIntelligenceReport` row (via getExecutiveSummary/getNarrativeReport,
 * which are themselves read-only, DB-first, Redis-fallback, never-generate)
 * — never the live generation path.
 */
import { escapeHtml, fmtTime, runCommand } from '@/lib/telegram-ops/commands';
import { env } from '@/lib/env';
import type { AuditStatus } from '@sitenexis/shared';

function partialBanner(isPartial: boolean): string {
  return isPartial ? '⚠️ <b>PARTIAL AUDIT</b> — some scores/evidence below may be unavailable, not zero.\n' : '';
}

function fmtScore(value: number | undefined | null, suffix = '/100'): string {
  return value === undefined || value === null ? 'unavailable' : `${Math.round(value)}${suffix}`;
}

function dashboardLink(domain: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/audit/${domain}`;
}

function formatScoreBlock(title: string, values: Record<string, number | null> | null): string {
  if (!values) return `\n<b>${title}</b>\nunavailable`;
  const rows = Object.entries(values).map(([k, v]) => `${k}: ${fmtScore(v)}`);
  return `\n<b>${title}</b>\n${rows.join('\n')}`;
}

export interface ResolvedUserAudit {
  domain: string;
  auditId: string;
  isPartial: boolean;
}

export async function requireLinkedConnection(telegramUserId: string) {
  const { getConnectionByTelegramUserId, touchLastInteraction } = await import('@sitenexis/db');
  const connection = await getConnectionByTelegramUserId(telegramUserId);
  if (!connection || connection.status !== 'linked') return null;
  await touchLastInteraction(telegramUserId);
  return connection;
}

/**
 * The single resolution path every command below starts from: linked
 * connection → the connection's own `activeDomain` → the latest *usable*
 * audit for that domain, scoped by `userId` at the DB layer (never a
 * cross-user lookup). Called *inside* runCommand's wrapped fn so the
 * resolution queries share the same 8s degrade-not-hang budget as the rest
 * of the command.
 */
export async function resolveActiveAuditOrExplain(telegramUserId: string, title: string): Promise<ResolvedUserAudit | string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';

  const domain = connection.activeDomain;
  if (!domain) {
    return 'No active website selected. Send /select <domain> first, or /websites to see your options.';
  }

  const { getLatestUsableAuditForDomainAndUser } = await import('@sitenexis/db');
  const result = await getLatestUsableAuditForDomainAndUser(domain, connection.siteNexisUserId);
  const escapedDomain = escapeHtml(domain);

  if (!result.audit) {
    if (!result.latestAny) return `<b>${title}</b>\nNo SiteNexis audits found for ${escapedDomain}. Send /audit to start one.`;
    const status: AuditStatus = result.latestAny.status;
    if (status === 'queued' || status === 'running') {
      return `<b>${title}</b>\nAn audit for ${escapedDomain} is currently ${status}. Send /status to check progress.`;
    }
    if (status === 'failed') {
      return `<b>${title}</b>\nThe most recent audit for ${escapedDomain} failed. Send /audit to try again.`;
    }
    return `<b>${title}</b>\nNo completed SiteNexis audit is available for ${escapedDomain} yet.`;
  }

  return { domain, auditId: result.audit.id, isPartial: result.isPartial };
}

/** /scores — full canonical scorecard, every tier that exists for the active audit. */
export async function commandScores(telegramUserId: string): Promise<string> {
  return runCommand('scores', 'Scores', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Scores');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Scores</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Scores</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');

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
      'Contradiction Absence': scorecard.machineTrust.contradictionAbsenceScore,
    } : null));

    if (scorecard.sii) {
      lines.push(formatScoreBlock('SII — Composite Index', { Score: scorecard.sii.score, Confidence: Math.round(scorecard.sii.confidence * 100) }));
    }

    lines.push(`\nScoring model: ${escapeHtml(scorecard.scoringModelLabel)}`);
    lines.push('More: /aivisibility /machinetrust /issues /fixplan /report');
    return lines.join('\n');
  });
}

/** /aivisibility — the V2 AI Visibility tier only. */
export async function commandAiVisibility(telegramUserId: string): Promise<string> {
  return runCommand('aivisibility', 'AI Visibility', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'AI Visibility');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>AI Visibility</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>AI Visibility</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(formatScoreBlock('', scorecard.v2 ? {
      'AI Visibility Score': scorecard.v2.aiVisibilityScore,
      'Machine Readability': scorecard.v2.machineReadabilityScore,
      'Entity Confidence': scorecard.v2.entityConfidenceScore,
      'Retrieval Readiness': scorecard.v2.retrievalReadinessScore,
      'Citation Probability': scorecard.v2.citationProbabilityScore,
      'Semantic Trust': scorecard.v2.semanticTrustScore,
      'Recommendation Confidence': scorecard.v2.recommendationConfidence,
    } : null));
    lines.push(`\nFull report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /retrieval — Retrieval Readiness + Machine Readability. */
export async function commandRetrieval(telegramUserId: string): Promise<string> {
  return runCommand('retrieval', 'Retrieval Readiness', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Retrieval Readiness');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Retrieval Readiness</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Retrieval Readiness</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Retrieval Readiness: ${fmtScore(scorecard.v2?.retrievalReadinessScore)}`);
    lines.push(`Machine Readability: ${fmtScore(scorecard.v2?.machineReadabilityScore)}`);
    lines.push(`\nMeasures whether an AI system can cleanly extract and retrieve this site's content. Full report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /machinetrust — Layer 4 Machine Trust. Overall is ALWAYS machine_trust_scores.overall, never semanticTrustScore. */
export async function commandMachineTrust(telegramUserId: string): Promise<string> {
  return runCommand('machinetrust', 'Machine Trust', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Machine Trust');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Machine Trust</b>\nAudit found, but scores are unavailable.`;
    if (!scorecard.machineTrust) {
      return [`<b>Machine Trust</b> — ${escapeHtml(domain)}`, partialBanner(isPartial), 'Machine Trust has not been computed for this audit (Layer 4 analysis is Pro+ only).'].filter((l) => l !== '').join('\n');
    }

    const lines: string[] = [`<b>Machine Trust</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Overall: ${fmtScore(scorecard.machineTrust.overall)}`);
    lines.push(`Entity Credibility: ${fmtScore(scorecard.machineTrust.entityCredibilityScore)}`);
    lines.push(`Schema Trust Alignment: ${fmtScore(scorecard.machineTrust.schemaTrustAlignmentScore)}`);
    lines.push(`External Validation: ${fmtScore(scorecard.machineTrust.externalValidationScore)}`);
    lines.push(`Contradiction Absence: ${fmtScore(scorecard.machineTrust.contradictionAbsenceScore)}`);
    lines.push(`\nFull report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /citation — Citation Probability. */
export async function commandCitation(telegramUserId: string): Promise<string> {
  return runCommand('citation', 'Citation Probability', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Citation Probability');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Citation Probability</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Citation Probability</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Citation Probability: ${fmtScore(scorecard.v2?.citationProbabilityScore)}`);
    lines.push(`\nModels the likelihood an AI system selects this content as a citation source. Full report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /entity — Entity Confidence + entity evidence. */
export async function commandEntity(telegramUserId: string): Promise<string> {
  return runCommand('entity', 'Entity Intelligence', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Entity Intelligence');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const [{ getAuditScorecard }, { getAuditEvidenceSummary }] = await Promise.all([
      import('@/lib/audit-intelligence/scorecard'),
      import('@/lib/audit-intelligence/evidence'),
    ]);
    const [scorecard, evidence] = await Promise.all([getAuditScorecard(auditId), getAuditEvidenceSummary(auditId)]);
    if (!scorecard) return `<b>Entity Intelligence</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Entity Intelligence</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Entity Confidence: ${fmtScore(scorecard.v2?.entityConfidenceScore)}`);
    if (evidence) {
      lines.push(`Primary entity: ${evidence.entities.primaryEntityName ? escapeHtml(evidence.entities.primaryEntityName) : 'not detected'}`);
      lines.push(`Entities detected: ${evidence.entities.count}`);
      lines.push(`sameAs links: ${evidence.entities.sameAsLinksCount}`);
    }
    lines.push(`\nFull report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /seo — V1 Technical SEO tier. */
export async function commandSeo(telegramUserId: string): Promise<string> {
  return runCommand('seo', 'Technical SEO', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Technical SEO');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Technical SEO</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Technical SEO</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(formatScoreBlock('', scorecard.v1 ? {
      Overall: scorecard.v1.overall, 'SEO Score': scorecard.v1.seoScore, 'AI Score': scorecard.v1.aiScore,
      Schema: scorecard.v1.schemaScore, 'Link Graph': scorecard.v1.linkGraphScore, Performance: scorecard.v1.performanceScore,
    } : null));
    lines.push(`\nFull report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /schema — schema coverage evidence + schema score. */
export async function commandSchema(telegramUserId: string): Promise<string> {
  return runCommand('schema', 'Schema', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Schema');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const [{ getAuditScorecard }, { getAuditEvidenceSummary }] = await Promise.all([
      import('@/lib/audit-intelligence/scorecard'),
      import('@/lib/audit-intelligence/evidence'),
    ]);
    const [scorecard, evidence] = await Promise.all([getAuditScorecard(auditId), getAuditEvidenceSummary(auditId)]);
    if (!scorecard) return `<b>Schema</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Schema</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Schema Score: ${fmtScore(scorecard.v1?.schemaScore)}`);
    if (evidence) {
      lines.push(`Pages with schema: ${evidence.schemaCoverage.pagesWithSchema}/${evidence.pageCount}`);
      lines.push(evidence.schemaCoverage.distinctSchemaTypes.length > 0
        ? `Types detected: ${evidence.schemaCoverage.distinctSchemaTypes.map(escapeHtml).join(', ')}`
        : 'Types detected: none');
    }
    lines.push(`\nFull report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /performance — Technical Performance score. */
export async function commandPerformance(telegramUserId: string): Promise<string> {
  return runCommand('performance', 'Performance', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Performance');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Performance</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Performance</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Performance Score: ${fmtScore(scorecard.v1?.performanceScore)}`);
    lines.push(`\nMeasured via Lighthouse on a sample of top pages. Full breakdown: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /links — Internal Link Graph score. */
export async function commandLinks(telegramUserId: string): Promise<string> {
  return runCommand('links', 'Link Graph', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Link Graph');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    const scorecard = await getAuditScorecard(auditId);
    if (!scorecard) return `<b>Link Graph</b>\nAudit found, but scores are unavailable.`;

    const lines: string[] = [`<b>Link Graph</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    lines.push(`Internal Link Strength: ${fmtScore(scorecard.v1?.linkGraphScore)}`);
    lines.push(`\nFull graph and orphan/dead-end page detail: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /issues — canonical, deduplicated, severity-grouped issue list. */
export async function commandIssues(telegramUserId: string): Promise<string> {
  return runCommand('issues', 'Issues', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Issues');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditIssueSummary } = await import('@/lib/audit-intelligence/issues');
    const summary = await getAuditIssueSummary(auditId);
    if (!summary) return `<b>Issues</b>\nAudit found, but issue data is unavailable.`;

    const lines: string[] = [`<b>Issues</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');

    const section = (label: string, items: typeof summary.critical, max: number) => {
      lines.push(`\n<b>${label}</b>`);
      if (items.length === 0) { lines.push('None'); return; }
      items.slice(0, max).forEach((it) => lines.push(`• ${escapeHtml(it.message)}`));
      if (items.length > max) lines.push(`…and ${items.length - max} more. See the SiteNexis dashboard.`);
    };

    section('CRITICAL', summary.critical, 10);
    section('WARNING', summary.warning, 8);
    section('INFO', summary.info, 5);

    lines.push(`\nView full list: ${dashboardLink(domain)}`);
    lines.push('Send /critical for critical issues only, or /fixplan for prioritized fixes.');
    return lines.join('\n');
  });
}

/** /critical — critical-severity issues only, from the same canonical dedupe as /issues. */
export async function commandCritical(telegramUserId: string): Promise<string> {
  return runCommand('critical', 'Critical Issues', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Critical Issues');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditIssueSummary } = await import('@/lib/audit-intelligence/issues');
    const summary = await getAuditIssueSummary(auditId);
    if (!summary) return `<b>Critical Issues</b>\nAudit found, but issue data is unavailable.`;

    const lines: string[] = [`<b>Critical Issues</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');
    if (summary.critical.length === 0) {
      lines.push('No critical issues found.');
    } else {
      summary.critical.forEach((it) => lines.push(`• ${escapeHtml(it.message)}`));
    }
    lines.push(`\nView full list: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /fixplan — canonical Fix Plan, priority-ordered. Reuses the exact same engine as the Roadmap tab. */
export async function commandFixplan(telegramUserId: string): Promise<string> {
  return runCommand('fixplan', 'Fix Plan', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Fix Plan');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const { getAuditFixPlan } = await import('@/lib/audit-intelligence/recommendations');
    const fixPlan = await getAuditFixPlan(auditId);
    if (!fixPlan) return `<b>Fix Plan</b>\nAudit found, but fix plan data is unavailable.`;
    if (fixPlan.items.length === 0) return `<b>Fix Plan</b> — ${escapeHtml(domain)}\nNo outstanding fixes.`;

    const lines: string[] = [`<b>Fix Plan</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');

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

    byPriority('P0 — Immediate', 'P0', 8);
    byPriority('P1 — High Priority', 'P1', 5);
    byPriority('P2 — Improvement', 'P2', 3);

    lines.push(`\nFix score: ${fmtScore(fixPlan.overallFixScore)} · Est. effort: ${fixPlan.estimatedTotalEffortHours}h`);
    lines.push(`View full roadmap: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

/** /report — the persisted canonical Intelligence Report (executive summary + narrative excerpt). Zero LLM calls: read-only, DB-first. */
export async function commandReport(telegramUserId: string): Promise<string> {
  return runCommand('report', 'Intelligence Report', async () => {
    const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Intelligence Report');
    if (typeof outcome === 'string') return outcome;
    const { domain, auditId, isPartial } = outcome;

    const [{ getExecutiveSummary }, { getNarrativeReport }] = await Promise.all([
      import('@/lib/audit-intelligence/executive-summary-service'),
      import('@/lib/audit-intelligence/narrative-report-service'),
    ]);
    const [summary, report] = await Promise.all([getExecutiveSummary(auditId), getNarrativeReport(auditId)]);

    if (!summary?.data && !report?.data) {
      return [
        `<b>Intelligence Report</b> — ${escapeHtml(domain)}`,
        'The prose Intelligence Report is not currently available for this audit yet. Scores, issues, and the fix plan remain available via /scores, /issues, /fixplan.',
        `View or regenerate the full report: ${dashboardLink(domain)}`,
      ].join('\n');
    }

    const lines: string[] = [`<b>Intelligence Report</b> — ${escapeHtml(domain)}`, partialBanner(isPartial)].filter((l) => l !== '');

    if (summary?.data) {
      lines.push('<b>Overall Assessment</b>');
      lines.push(`${summary.data.composite_score.toFixed(1)}/10 — ${escapeHtml(summary.data.composite_label)}`);
      lines.push(escapeHtml(summary.data.overall_verdict));

      const findings = summary.data.sections.flatMap((s) => s.issues.map((issue) => `${s.name}: ${issue}`)).slice(0, 6);
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
    }

    if (report?.data) {
      const data = report.data;
      const overview = typeof data.summary === 'string' ? data.summary : (typeof data.overview === 'string' ? data.overview : null);
      if (overview) { lines.push(''); lines.push('<b>Narrative Overview</b>'); lines.push(escapeHtml(overview)); }

      const sections = Array.isArray(data.sections) ? data.sections as Array<Record<string, unknown>> : [];
      for (const section of sections.slice(0, 6)) {
        const name = typeof section.name === 'string' ? section.name : (typeof section.title === 'string' ? section.title : null);
        const narrative = typeof section.narrative === 'string' ? section.narrative : (typeof section.content === 'string' ? section.content : null);
        if (name) lines.push(`\n<b>${escapeHtml(name)}</b>`);
        if (narrative) lines.push(escapeHtml(narrative));
      }
    }

    lines.push('');
    lines.push(`This is an executive excerpt. Full report: ${dashboardLink(domain)}`);
    return lines.join('\n');
  });
}

function diffLine(label: string, older: number | undefined | null, newer: number | undefined | null): string {
  if (older == null || newer == null) return `${label}: unavailable for comparison`;
  const o = Math.round(older);
  const n = Math.round(newer);
  const delta = n - o;
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '▬';
  const sign = delta > 0 ? '+' : '';
  return `${label}: ${o} → ${n} (${arrow} ${sign}${delta})`;
}

/** /compare — the latest two COMPLETE audits for the linked user's active domain, score-by-score. */
export async function commandCompare(telegramUserId: string): Promise<string> {
  return runCommand('compare', 'Compare', async () => {
    const connection = await requireLinkedConnection(telegramUserId);
    if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';

    const domain = connection.activeDomain;
    if (!domain) return 'No active website selected. Send /select <domain> first, or /websites to see your options.';

    const { getLatestTwoCompleteAuditsForDomainAndUser } = await import('@sitenexis/db');
    const audits = await getLatestTwoCompleteAuditsForDomainAndUser(domain, connection.siteNexisUserId);

    if (audits.length < 2) {
      return `<b>Compare</b> — ${escapeHtml(domain)}\nNeed at least 2 completed audits to compare. You currently have ${audits.length}. Send /audit to run another.`;
    }

    const [newer, older] = audits;
    const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
    // Sequential, not Promise.all: getAuditScorecard does its own internal
    // `await import('@sitenexis/db')` per call, and firing two of those
    // concurrently for the same module is unreliable — fetch newer then
    // older instead of racing them.
    const newerCard = await getAuditScorecard(newer.id);
    const olderCard = await getAuditScorecard(older.id);

    if (!newerCard || !olderCard) {
      return `<b>Compare</b> — ${escapeHtml(domain)}\nBoth audits were found, but scores are unavailable for at least one of them.`;
    }

    const lines: string[] = [
      `<b>Compare</b> — ${escapeHtml(domain)}`,
      `${fmtTime(older.completedAt)} → ${fmtTime(newer.completedAt)}`,
      '',
      diffLine('AI Visibility', olderCard.v2?.aiVisibilityScore, newerCard.v2?.aiVisibilityScore),
      diffLine('Retrieval Readiness', olderCard.v2?.retrievalReadinessScore, newerCard.v2?.retrievalReadinessScore),
      diffLine('Citation Probability', olderCard.v2?.citationProbabilityScore, newerCard.v2?.citationProbabilityScore),
      diffLine('Semantic Trust', olderCard.v2?.semanticTrustScore, newerCard.v2?.semanticTrustScore),
      diffLine('Entity Confidence', olderCard.v2?.entityConfidenceScore, newerCard.v2?.entityConfidenceScore),
      diffLine('Machine Trust', olderCard.machineTrust?.overall, newerCard.machineTrust?.overall),
      diffLine('Technical SEO', olderCard.v1?.overall, newerCard.v1?.overall),
      '',
      `Full history: ${dashboardLink(domain)}`,
    ];
    return lines.join('\n');
  });
}
