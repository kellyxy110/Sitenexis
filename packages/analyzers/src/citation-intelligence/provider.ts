import type { CitationEvidence, CitationIntelligenceStatus } from '@sitenexis/shared';

/**
 * Optional external discovery contract. The free Citation Intelligence core
 * never instantiates this interface. Future adapters must be feature-gated and
 * return provenance-rich data without changing the crawl-only score.
 */
export interface CitationDiscoveryRequest {
  userId: string;
  domain: string;
  auditId?: string;
  signal?: AbortSignal;
}

export interface CitationDiscoveryResponse {
  status: Extract<CitationIntelligenceStatus, 'completed' | 'partial' | 'failed' | 'not_configured' | 'no_data'>;
  provider: string;
  providerVersion: string;
  evidence: CitationEvidence[];
  quota?: { used?: number; remaining?: number };
  failureReason?: string;
}

export interface CitationDiscoveryProvider {
  readonly id: string;
  discover(request: CitationDiscoveryRequest): Promise<CitationDiscoveryResponse>;
}
