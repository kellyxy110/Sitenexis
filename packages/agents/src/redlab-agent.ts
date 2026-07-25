import type { CrawledPage, RedLabReport } from '@sitenexis/shared';
import { buildRedLabReport } from '@sitenexis/analyzers';
import { probeSensitivePaths } from '@sitenexis/crawler';
import { saveRedLabReport } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

/**
 * RedLab passive attack-surface recon. Layer 4 only: the sensitive-path
 * probe adds real HTTP requests against the audited domain, so it is
 * gated the same way as the other deeper security checks.
 *
 * Deliberately read-only — see @sitenexis/shared/redlab for the scope
 * rationale (audits run against arbitrary user-submitted domains, so
 * active exploitation techniques are out of scope by design).
 */
export async function runRedLabAgent(auditId: string, domain: string, pages: CrawledPage[]): Promise<RedLabReport> {
  await emitAgentEvent({ auditId, agentId: 'redlab', event: 'started' });

  const scriptSources = pages.flatMap((page) => page.scriptSources ?? []);

  try {
    const pathProbeResults = await probeSensitivePaths(domain);
    const report = buildRedLabReport({ pathProbeResults, scriptSources });
    await saveRedLabReport(auditId, report);

    await emitAgentEvent({
      auditId,
      agentId: 'redlab',
      event: 'completed',
      payload: { overallScore: report.overallScore, exposedPathCount: report.exposedPaths.length, vulnerableLibraryCount: report.vulnerableLibraries.length },
    });

    return report;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await emitAgentEvent({ auditId, agentId: 'redlab', event: 'failed', errorMessage });
    // Partial-failure philosophy (CLAUDE.md §30): never fail the audit for this.
    return buildRedLabReport({ pathProbeResults: [], scriptSources });
  }
}
