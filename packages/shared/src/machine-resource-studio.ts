export type MRSSeverity = 'critical' | 'warning' | 'info';
export type MRSPriority = 'P0' | 'P1' | 'P2';

export interface MRSInputIssue { id: string; module: string; type: string; severity: MRSSeverity; message: string; recommendation: string; pageUrl?: string | null; createdAt: string; }
export interface MRSInputPage { id: string; url: string; statusCode: number; isIndexable: boolean; wordCount: number; internalLinks: number; externalLinks: number; }
export interface MRSInputScore { overall: number; seoScore: number; aiScore: number; schemaScore: number; linkGraphScore: number; performanceScore: number; }
export interface MRSInputAIVisibility { aiVisibilityScore: number; machineReadabilityScore: number; entityConfidenceScore: number; retrievalReadinessScore: number; citationProbabilityScore: number; semanticTrustScore: number; recommendationConfidence: number; }
export interface MRSInputMachineTrust { overall: number; }
export interface MRSInput { audit: { id: string; domain: string; completedAt: string | null; pageCount: number | null }; scores: MRSInputScore | null; aiVisibility: MRSInputAIVisibility | null; machineTrust: MRSInputMachineTrust | null; pages: MRSInputPage[]; issues: MRSInputIssue[]; }

export interface MRSScore { key: string; label: string; value: number | null; confidence: number; formula: string; evidenceCount: number; }
export interface MRSEvidence { id: string; source: 'crawl' | 'issue' | 'score' | 'ai-visibility'; module: string; detail: string; timestamp: string; confidence: number; }
export interface MRSRecommendation { id: string; priority: MRSPriority; module: string; title: string; explanation: string; implementationGuide: string; businessImpact: string; seoImpact: string; aiImpact: string; difficulty: 'low' | 'medium' | 'high'; estimatedTime: string; confidence: number; evidenceIds: string[]; }
export interface MRSReport { auditId: string; domain: string; generatedAt: string; overallScore: number | null; executiveSummary: string; technicalExplanation: string; aiExplanation: string; strengths: string[]; weaknesses: string[]; scoreCards: MRSScore[]; issueDistribution: Array<{ label: string; value: number; color: string }>; recommendations: MRSRecommendation[]; evidence: MRSEvidence[]; limitations: string[]; }
