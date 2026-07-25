export type CitationSignalType =
  | 'internal_citation' | 'external_reference' | 'same_as' | 'research'
  | 'government' | 'standards' | 'developer' | 'social' | 'community'
  | 'news' | 'education' | 'structured_citation';

export type CitationIntelligenceStatus =
  | 'pending' | 'running' | 'completed' | 'partial' | 'failed'
  | 'not_configured' | 'not_applicable' | 'no_data';

export type CitationAvailabilityState =
  | 'available_with_evidence'
  | 'available_no_evidence'
  | 'partially_available'
  | 'unavailable'
  | 'failed';

export interface CitationEvidence {
  id: string;
  type: CitationSignalType;
  sourceUrl: string;
  targetUrl: string;
  sourcePage?: string;
  anchorText?: string;
  context?: string;
  observedAt: string;
  confidence: number;
  provenance: 'first_party_crawl' | 'structured_data' | 'provider';
}

export interface CitationGap {
  category: 'research' | 'government' | 'standards' | 'developer' | 'education' | 'news' | 'community' | 'entity';
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  expectedImpact: 'high' | 'medium' | 'low';
  evidence: CitationEvidence[];
  nextStep: string;
  verification: string;
}

export interface CitationIntelligenceRecommendation {
  id: string;
  title: string;
  why: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  expectedImpact: 'high' | 'medium' | 'low';
  affectedPages: string[];
  evidenceIds: string[];
  verification: string;
}

export interface CitationIntelligenceResult {
  status: CitationIntelligenceStatus;
  availabilityState: CitationAvailabilityState;
  providerState: 'not_configured' | 'not_applicable' | 'available' | 'failed';
  evidenceState: 'evidence_found' | 'no_evidence_found';
  auditId?: string;
  domain: string;
  summary: string;
  generatedAt: string;
  engineVersion: string;
  confidence: number;
  limitations: string[];
  scores: {
    citation: number | null;
    authority: number | null;
    trust: number | null;
    aiCitation: number | null;
    entity: number | null;
    brandRecognition: number | null;
    evidence: number | null;
    recommendation: number | null;
    digitalAuthority: number | null;
  };
  counts: {
    pagesAnalyzed: number;
    signals: number;
    externalReferences: number;
    internalCitations: number;
    sameAsReferences: number;
    sourceCategories: number;
  };
  signals: CitationEvidence[];
  gaps: CitationGap[];
  recommendations: CitationIntelligenceRecommendation[];
}
