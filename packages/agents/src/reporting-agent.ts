// Stub — full implementation in a later prompt
import { emitAgentEvent } from './registry';

export async function runReportingAgent(auditId: string): Promise<void> {
  await emitAgentEvent({ auditId, agentId: 'reporting', event: 'started' });
  // TODO: PDF generation, S3 upload, Report record creation (60s timeout)
  await emitAgentEvent({ auditId, agentId: 'reporting', event: 'completed' });
}
