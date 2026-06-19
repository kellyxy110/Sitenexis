import { Queue, Worker, type Job } from 'bullmq';
import { createRedisClient } from '@sitenexis/crawler';

export type AgentEvent = 'started' | 'progress' | 'completed' | 'failed';

export interface AgentMessage {
  auditId: string;
  agentId: string;
  event: AgentEvent;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  retryCount?: number;
  timestamp: Date;
}

export type AgentId =
  | 'crawl'
  | 'seo'
  | 'schema'
  | 'retrieval'
  | 'entity'
  | 'performance'
  | 'citation'
  | 'semantic-trust'
  | 'reporting'
  | 'visualization'
  | 'infrastructure'
  | 'retrieval-simulation'
  | 'machine-trust'
  | 'temporal-authority'
  | 'recommendation-mapping'
  | 'synthetic-entity'
  | 'information-gain'
  | 'scout';

const connection = createRedisClient(true);

export const agentBus = new Queue<AgentMessage>('agent-bus', { connection });

export async function emitAgentEvent(message: Omit<AgentMessage, 'timestamp'>): Promise<void> {
  await agentBus.add(message.agentId, { ...message, timestamp: new Date() });
}

export function createAgentWorker(
  agentId: AgentId,
  handler: (job: Job<AgentMessage>) => Promise<void>
): Worker<AgentMessage> {
  return new Worker<AgentMessage>(
    'agent-bus',
    async (job) => {
      if (job.data.agentId !== agentId) return;
      await handler(job);
    },
    { connection, concurrency: 1 }
  );
}
