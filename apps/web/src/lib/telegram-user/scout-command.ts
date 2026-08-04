/**
 * Telegram User Assistant — /scout (T5).
 *
 * Scout is the ONLY Telegram command allowed to invoke conversational AI.
 * Every other intelligence command (see intelligence-commands.ts) is a
 * zero-LLM read of already-computed canonical data. Scout answers a
 * free-text question by assembling a grounding context from that SAME
 * canonical data — the exact same scorecard/issues/fix-plan/evidence/report
 * services T4 already reads — and handing it to `answerScoutQuestion` in
 * `@sitenexis/analyzers`, the single place in the codebase that turns a
 * question into an AI call. No AI client is instantiated here.
 *
 * Domain ownership is enforced by reusing `resolveActiveAuditOrExplain`
 * from intelligence-commands.ts unchanged — the identical userId-scoped
 * resolution path used by all 15 T4 commands, so Scout cannot be used to
 * probe another user's audit any more than /scores can.
 */
import { escapeHtml } from '@/lib/telegram-ops/commands';
import { resolveActiveAuditOrExplain } from './intelligence-commands';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ScoutChatContext } from '@sitenexis/analyzers';

const SCOUT_TIMEOUT_MS = 25_000;
// Each question triggers a real AI call (cost + latency), unlike every other
// Telegram command. 5/min per user is generous for genuine back-and-forth
// use while bounding worst-case AI spend from a single account.
const SCOUT_RATE_LIMIT = { limit: 5, windowSec: 60 };

class ScoutTimeoutError extends Error {}

function withScoutTimeout<T>(promise: Promise<T>, ms = SCOUT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new ScoutTimeoutError(`Timed out after ${ms}ms`)), ms);
    }),
  ]);
}

function dashboardLink(domain: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/audit/${domain}`;
}

function usageText(): string {
  return [
    '<b>Scout</b>',
    'Ask a question about your latest audit and Scout will answer using your actual SiteNexis data. Examples:',
    '• /scout What should I fix first?',
    '• /scout Why is my Machine Trust low?',
    '• /scout Which pages have citation problems?',
    '• /scout Explain my AI Visibility score.',
  ].join('\n');
}

/** /scout <question> — the only Telegram command that invokes conversational AI. */
export async function commandScout(telegramUserId: string, args: string[]): Promise<string> {
  const question = args.join(' ').trim();
  if (!question) return usageText();

  const rl = await rateLimit('telegram:scout', telegramUserId, SCOUT_RATE_LIMIT);
  if (!rl.ok) {
    return '<b>Scout</b>\nYou’re asking faster than Scout can keep up. Try again in about a minute.';
  }

  const outcome = await resolveActiveAuditOrExplain(telegramUserId, 'Scout');
  if (typeof outcome === 'string') return outcome;
  const { domain, auditId, isPartial } = outcome;

  try {
    return await withScoutTimeout(runScout(domain, auditId, isPartial, question));
  } catch (err) {
    const timedOut = err instanceof ScoutTimeoutError;
    logger.error(
      { err: err instanceof Error ? err.message : String(err), timedOut, auditId },
      'Telegram Scout command degraded',
    );
    return [
      '<b>Scout</b>',
      `⚠️ Scout is temporarily unavailable ${timedOut ? '(taking too long to respond)' : '(could not generate an answer right now)'}.`,
      'In the meantime: /scores, /issues, and /fixplan are always available.',
    ].join('\n');
  }
}

async function runScout(domain: string, auditId: string, isPartial: boolean, question: string): Promise<string> {
  // Sequential, not Promise.all: each canonical service below does its own
  // internal `await import('@sitenexis/db')`, and firing several such
  // dynamic imports concurrently is unreliable under module-mock
  // interception (the same class of bug found and fixed in /compare —
  // see intelligence-commands.ts). Six calls at a few ms each is still
  // well inside Scout's 25s budget.
  const { getAuditScorecard } = await import('@/lib/audit-intelligence/scorecard');
  const scorecard = await getAuditScorecard(auditId);

  const { getAuditIssueSummary } = await import('@/lib/audit-intelligence/issues');
  const issues = await getAuditIssueSummary(auditId);

  const { getAuditFixPlan } = await import('@/lib/audit-intelligence/recommendations');
  const fixPlan = await getAuditFixPlan(auditId);

  const { getAuditEvidenceSummary } = await import('@/lib/audit-intelligence/evidence');
  const evidence = await getAuditEvidenceSummary(auditId);

  const { getExecutiveSummary } = await import('@/lib/audit-intelligence/executive-summary-service');
  const execSummary = await getExecutiveSummary(auditId);

  const { getScoutAnalysis } = await import('@sitenexis/db');
  const scoutIntent = await getScoutAnalysis(auditId).catch(() => null);

  if (!scorecard && !issues && !fixPlan && !evidence) {
    return [
      `<b>Scout</b> — ${escapeHtml(domain)}`,
      'There isn’t enough audit data available yet to answer questions about this domain. Send /audit to run one, or check back once it completes.',
    ].join('\n');
  }

  const context: ScoutChatContext = {
    domain,
    auditStatus: scorecard?.status ?? 'unknown',
    isPartialAudit: isPartial,
    scores: {
      aiVisibility: scorecard?.v2?.aiVisibilityScore ?? null,
      machineReadability: scorecard?.v2?.machineReadabilityScore ?? null,
      entityConfidence: scorecard?.v2?.entityConfidenceScore ?? null,
      retrievalReadiness: scorecard?.v2?.retrievalReadinessScore ?? null,
      citationProbability: scorecard?.v2?.citationProbabilityScore ?? null,
      semanticTrust: scorecard?.v2?.semanticTrustScore ?? null,
      machineTrustOverall: scorecard?.machineTrust?.overall ?? null,
      machineTrustEntityCredibility: scorecard?.machineTrust?.entityCredibilityScore ?? null,
      machineTrustSchemaAlignment: scorecard?.machineTrust?.schemaTrustAlignmentScore ?? null,
      machineTrustExternalValidation: scorecard?.machineTrust?.externalValidationScore ?? null,
      machineTrustContradictionAbsence: scorecard?.machineTrust?.contradictionAbsenceScore ?? null,
      technicalSeoOverall: scorecard?.v1?.overall ?? null,
      schemaScore: scorecard?.v1?.schemaScore ?? null,
      linkGraphScore: scorecard?.v1?.linkGraphScore ?? null,
      performanceScore: scorecard?.v1?.performanceScore ?? null,
    },
    topCriticalIssues: (issues?.critical ?? []).slice(0, 10).map((i) => i.message),
    topWarningIssues: (issues?.warning ?? []).slice(0, 8).map((i) => i.message),
    fixPlanTopItems: (fixPlan?.items ?? []).slice(0, 10).map((i) => ({
      priority: i.priority,
      message: i.message,
      recommendation: i.recommendation,
    })),
    evidence: evidence ? {
      pageCount: evidence.pageCount,
      primaryEntityName: evidence.entities.primaryEntityName,
      entityCount: evidence.entities.count,
      sameAsLinksCount: evidence.entities.sameAsLinksCount,
      pagesWithSchema: evidence.schemaCoverage.pagesWithSchema,
      pagesWithoutSchema: evidence.schemaCoverage.pagesWithoutSchema,
      distinctSchemaTypes: evidence.schemaCoverage.distinctSchemaTypes,
      indexablePages: evidence.indexability.indexablePages,
      nonIndexablePages: evidence.indexability.nonIndexablePages,
    } : null,
    executiveVerdict: execSummary?.data?.overall_verdict ?? null,
    scoutIntent: scoutIntent ? {
      state: scoutIntent.state,
      dominantIntent: scoutIntent.dominantIntent ?? null,
      intentCoverageScore: scoutIntent.intentCoverageScore ?? null,
      intentAlignmentScore: scoutIntent.intentAlignmentScore ?? null,
    } : null,
  };

  const { answerScoutQuestion } = await import('@sitenexis/analyzers');
  const result = await answerScoutQuestion(context, question);

  const lines: string[] = [`<b>Scout</b> — ${escapeHtml(domain)}`];
  if (isPartial) lines.push('⚠️ <b>PARTIAL AUDIT</b> — some data below may be unavailable, not zero.');
  lines.push('');
  lines.push(escapeHtml(result.answer));

  if (!result.evidenceAvailable) {
    lines.push('');
    lines.push('<i>Scout did not have enough audit data to fully answer this — the response above may be incomplete.</i>');
  }

  if (result.observedEvidence.length > 0) {
    lines.push('');
    lines.push('<b>Observed evidence</b>');
    result.observedEvidence.slice(0, 6).forEach((e) => lines.push(`• ${escapeHtml(e)}`));
  }

  if (result.derivedIntelligence.length > 0) {
    lines.push('');
    lines.push('<b>SiteNexis intelligence</b>');
    result.derivedIntelligence.slice(0, 4).forEach((e) => lines.push(`• ${escapeHtml(e)}`));
  }

  if (result.interpretation) {
    lines.push('');
    lines.push('<b>Scout’s interpretation</b>');
    lines.push(escapeHtml(result.interpretation));
  }

  lines.push('');
  lines.push(`Full report: ${dashboardLink(domain)}`);
  return lines.join('\n');
}
