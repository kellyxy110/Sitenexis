import type { AiGovernanceReport } from '@sitenexis/shared';
import { buildAiGovernanceReport } from '@sitenexis/analyzers';
import { probeAiGovernance } from '@sitenexis/crawler';
import { saveAiGovernanceReport } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

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
    const probeResult = await probeAiGovernance(domain);
    const report = buildAiGovernanceReport(probeResult);
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
