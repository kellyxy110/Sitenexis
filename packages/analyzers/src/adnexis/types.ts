export interface AdAnalysisResult {
  hook: {
    text: string;
    type: 'curiosity' | 'shock' | 'authority' | 'story' | 'fear' | 'transformation';
    score: number;
  };
  emotions: {
    primary: string;
    stack: string[];
    intensity: number;
  };
  funnel: {
    stage: 'TOFU' | 'MOFU' | 'BOFU';
    journey: 'awareness' | 'consideration' | 'conversion';
  };
  cta: {
    text: string;
    type: 'scarcity' | 'soft' | 'urgency' | 'curiosity';
    strength: number;
  };
  audience: {
    description: string;
    sophistication: 'cold' | 'warm' | 'hot';
    painPoint: string;
  };
  structure: {
    narrativeArc: string;
    pacing: 'fast' | 'medium' | 'slow';
    proofElements: string[];
  };
  scores: {
    overall: number;
    hookStrength: number;
    emotionalIntensity: number;
    novelty: number;
    audienceFit: number;
    platformFit: number;
  };
  conversionLikelihood: string;
  fatigueRisk: 'low' | 'medium' | 'high';
  estimatedRunwayDays?: number;
  recommendations: string[];
}

export interface HookAnalysisResult {
  hookText: string;
  hookType: 'curiosity' | 'shock' | 'authority' | 'story' | 'fear' | 'transformation';
  primaryEmotion: string;
  emotionStack: string[];
  funnelStage: 'TOFU' | 'MOFU' | 'BOFU';
  targetAudience: string;
  psychologicalMechanism: string;
  whyItWorks: string;
  hookStrengthScore: number;
  weaknesses: string[];
  improvements: string[];
}

export interface AdVariation {
  label: string;
  platform: string;
  hook: string;
  body: string;
  cta: string;
  hookType: string;
  primaryEmotion: string;
  predictedScore: number;
  rationale: string;
}

export interface RegenerationResult {
  variations: AdVariation[];
}

export interface PerformancePrediction {
  scores: {
    overall: number;
    hookStrength: number;
    emotionalIntensity: number;
    novelty: number;
    audienceFit: number;
    platformAlignment: number;
  };
  conversionLikelihood: string;
  fatigueRisk: 'low' | 'medium' | 'high';
  estimatedRunwayDays: number;
  verdict: string;
  topRisk: string;
}

export interface HookGenerationResult {
  hooks: Array<{
    text: string;
    type: string;
    emotion: string;
    strength: number;
    rationale: string;
  }>;
}

export interface AdAnalyzerOptions {
  anthropicApiKey?: string;
  groqApiKey?: string;
}
