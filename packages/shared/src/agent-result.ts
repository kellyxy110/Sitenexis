export const AGENT_RESULT_STATUSES = [
  'pending', 'running', 'completed', 'partial', 'failed',
  'not_configured', 'not_applicable', 'no_data',
] as const;

export type AgentResultStatus = (typeof AGENT_RESULT_STATUSES)[number];
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AgentFinding {
  id: string;
  title: string;
  message: string;
  severity: FindingSeverity;
  evidence: string[];
  affectedPages: string[];
  recommendation: string;
  confidence: number | null;
}

export interface AgentResultContract<T = unknown> {
  status: AgentResultStatus;
  score: number | null;
  summary: string | null;
  findings: AgentFinding[];
  evidence: string[];
  affectedPages: string[];
  severity: FindingSeverity | null;
  confidence: number | null;
  recommendations: string[];
  generatedAt: string;
  engineVersion: string;
  failureReason?: string;
  data?: T;
}

export interface AuditAgentState {
  agent: string;
  status: AgentResultStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  retryCount: number;
  keyOutput: string | null;
  resultPersisted: boolean;
  failureReason?: string;
}

export interface AuditAgentManifest {
  version: 1;
  required: string[];
  agents: Record<string, AuditAgentState>;
  updatedAt: string;
}

export const DEFAULT_AUDIT_AGENTS = [
  'crawl', 'seo', 'schema', 'retrieval', 'entity', 'performance', 'citation',
  'semantic-trust', 'reporting', 'visualization', 'infrastructure',
  'retrieval-simulation', 'machine-trust', 'temporal-authority',
  'recommendation-mapping', 'synthetic-entity', 'information-gain', 'scout',
] as const;

export function isTerminalAgentStatus(status: AgentResultStatus): boolean {
  return ['completed', 'partial', 'failed', 'not_configured', 'not_applicable', 'no_data'].includes(status);
}
