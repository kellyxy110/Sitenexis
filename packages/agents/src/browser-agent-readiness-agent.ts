import type { CrawledPage, GraphNode } from '@sitenexis/shared';
import { probeInteractionBlockers } from '@sitenexis/crawler/interaction-blocker-probe';
import { saveBrowserAgentProbes } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

const MAX_PROBED_PAGES = 5;

/**
 * Launches a real headless-browser session against a sample of pages to
 * detect interaction blockers (cookie walls, CAPTCHAs, login walls) that a
 * static crawl cannot see — an autonomous browser-driven agent encounters
 * these before it ever reaches page content.
 *
 * Layer 4 only (gated by layer4Enabled in the caller): each probe is a real
 * Chrome navigation, so this is capped at MAX_PROBED_PAGES, matching the
 * Performance Agent's top-5-by-PageRank convention.
 *
 * Partial-failure philosophy (CLAUDE.md §30): a probe failure never fails
 * the audit — it is logged via the failed event and the audit proceeds
 * without a browser-agent-readiness score for this run.
 */
export async function runBrowserAgentReadinessAgent(
  auditId: string,
  pages: CrawledPage[],
  pageRankNodes?: GraphNode[],
): Promise<void> {
  await emitAgentEvent({ auditId, agentId: 'browser-agent-readiness', event: 'started' });

  const rankedUrls = pageRankNodes && pageRankNodes.length > 0
    ? [...pageRankNodes].sort((a, b) => b.pageRank - a.pageRank).map((node) => node.url)
    : pages.map((page) => page.url);
  const targetUrls = rankedUrls.slice(0, MAX_PROBED_PAGES);

  try {
    const probes = await probeInteractionBlockers(targetUrls);
    await saveBrowserAgentProbes(auditId, probes);

    await emitAgentEvent({
      auditId,
      agentId: 'browser-agent-readiness',
      event: 'completed',
      payload: {
        pagesProbed: probes.length,
        blockersFound: probes.reduce((sum, probe) => sum + probe.blockers.length, 0),
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await emitAgentEvent({ auditId, agentId: 'browser-agent-readiness', event: 'failed', errorMessage });
    // Never rethrow — this agent's failure must not void the rest of the audit.
  }
}
