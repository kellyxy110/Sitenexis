// On-demand HTML reports are available via POST /api/audit/[id]/report.
// This agent handles the background S3 PDF path (full implementation deferred).
import { emitAgentEvent } from './registry';

export async function runReportingAgent(auditId: string): Promise<void> {
  await emitAgentEvent({ auditId, agentId: 'reporting', event: 'started' });
  // S3 PDF upload not yet implemented — on-demand HTML download via API route is the active path.
  await emitAgentEvent({ auditId, agentId: 'reporting', event: 'completed' });
}
