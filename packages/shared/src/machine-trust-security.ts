export type MachineResourceKind =
  | 'page'
  | 'structured_data'
  | 'machine_resource'
  | 'response_headers';

export type MachineTrustSeverity = 'critical' | 'warning' | 'info';

export type PromptInjectionSignal =
  | 'instruction_override'
  | 'role_impersonation'
  | 'tool_manipulation'
  | 'credential_request'
  | 'data_exfiltration'
  | 'memory_or_rag_poisoning'
  | 'obfuscation'
  | 'hidden_instruction';

export interface MachineTrustResource {
  id: string;
  kind: MachineResourceKind;
  url: string;
  content: string;
  fetchedAt: string;
  headers?: Record<string, string>;
}

export interface MachineTrustEvidence {
  id: string;
  resourceId: string;
  source: string;
  excerpt: string;
  detectionMethod: 'pattern_match' | 'unicode_scan' | 'header_check' | 'coverage_check';
}

export interface MachineTrustFinding {
  id: string;
  code: string;
  category: PromptInjectionSignal | 'resource_integrity' | 'security_headers' | 'coverage';
  severity: MachineTrustSeverity;
  title: string;
  explanation: string;
  recommendation: string;
  resourceId: string | null;
  evidenceIds: string[];
  confidence: number;
}

export interface MachineTrustScoreBreakdown {
  promptInjectionRisk: number | null;
  machineResourceIntegrity: number | null;
  structuredDataIntegrity: number | null;
  aiCrawlerCompatibility: number | null;
  thirdPartyScriptTrust: number | null;
  dataLeakageRisk: number | null;
  agentSafety: number | null;
  contentProvenance: number | null;
  securityHeaders: number | null;
  monitoring: number | null;
}

export interface MachineTrustSecurityReport {
  version: string;
  assessedAt: string;
  overallScore: number | null;
  confidence: number;
  scoreBreakdown: MachineTrustScoreBreakdown;
  findings: MachineTrustFinding[];
  evidence: MachineTrustEvidence[];
  resourcesAssessed: number;
  limitations: string[];
}
