import type { AiGovernanceReport } from '@sitenexis/shared';
import { buildAiGovernanceReport } from '@sitenexis/analyzers';
import { saveAiGovernanceReport } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

const FETCH_TIMEOUT_MS = 5_000;

function toOrigin(domain: string): string {
  const withProtocol = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return new URL(withProtocol).origin;
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.ok || res.status === 405) return true;
    if (res.status === 404 || res.status === 403) return false;
    return false;
  } catch {
    return false;
  }
}

/**
 * Assesses the domain's declared AI-use policy: the Content-Signal directive
 * (an emerging robots.txt convention), named AI crawler allow/disallow rules,
 * and presence of llms.txt / ai.txt / security.txt.
 *
 * Cheap (plain fetch/HEAD requests, no headless browser) — runs for every
 * plan tier alongside SEO/Schema, unlike the Layer 4 browser-agent probe.
 */
export async function runAiGovernanceAgent(auditId: string, domain: string): Promise<AiGovernanceReport> {
  await emitAgentEvent({ auditId, agentId: 'ai-governance', event: 'started' });

  try {
    const origin = toOrigin(domain);
    const [robotsTxtContent, hasLlmsTxt, hasAiTxt, hasSecurityTxt] = await Promise.all([
      fetchText(`${origin}/robots.txt`),
      exists(`${origin}/llms.txt`),
      exists(`${origin}/ai.txt`),
      exists(`${origin}/.well-known/security.txt`),
    ]);

    const report = buildAiGovernanceReport({ robotsTxtContent, hasLlmsTxt, hasAiTxt, hasSecurityTxt });
    await saveAiGovernanceReport(auditId, report);

    await emitAgentEvent({
      auditId,
      agentId: 'ai-governance',
      event: 'completed',
      payload: { overallScore: report.overallScore, issueCount: report.issues.length },
    });

    return report;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await emitAgentEvent({ auditId, agentId: 'ai-governance', event: 'failed', errorMessage });
    // Partial-failure philosophy (CLAUDE.md §30): never fail the audit for this.
    const fallback = buildAiGovernanceReport({ robotsTxtContent: '', hasLlmsTxt: false, hasAiTxt: false, hasSecurityTxt: false });
    return fallback;
  }
}
