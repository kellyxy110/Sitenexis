// Stub — full implementation in a later prompt (Section 26 of CLAUDE.md)
import { type CrawledPage } from '@sitenexis/shared';
import { emitAgentEvent } from './registry';

export async function runSyntheticEntityAgent(
  auditId: string,
  _pages: CrawledPage[]
): Promise<void> {
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'started' });
  // Detection rules from /config/synthetic-detection-rules.json — never hardcoded
  // All findings: confidence (0–1), never binary flags
  // Results shown to domain owner only — never in competitive view
  // Partial failure: skip failing pattern, continue
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'completed' });
}
