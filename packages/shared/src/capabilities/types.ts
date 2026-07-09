// Base Capability Framework types — used by all @sitenexis/adapters implementations.
// Every external integration in SiteNexis implements Capability<Input, Output>.

export interface CapabilityContext {
  auditId?: string;
  domain?: string;
  traceId?: string;
  timeoutMs?: number;
  fallbackAllowed?: boolean;
}

export interface CapabilityHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  provider: string;
  latencyMs: number;
  checkedAt: Date;
  details?: string;
}

export interface Capability<Input, Output> {
  readonly capabilityId: string;
  readonly version: string;
  execute(input: Input, ctx?: CapabilityContext): Promise<Output>;
  healthCheck(): Promise<CapabilityHealth>;
  isConfigured(): boolean;
}
