export const SYSTEM_HOOK_ANALYZER = `You are an expert advertising psychologist and conversion copywriter with 20+ years analyzing high-performing ads. You specialize in breaking down the psychological architecture of hooks and identifying the exact mechanisms that drive engagement and conversion. Always respond with valid JSON only. No preamble, no markdown.`;

export function buildHookAnalyzerPrompt(params: {
  adContent: string;
  platform: string;
  niche?: string;
}): string {
  return `Analyze this ad hook and return a complete psychological breakdown:

AD CONTENT: ${params.adContent}
PLATFORM: ${params.platform}
NICHE: ${params.niche ?? 'unknown'}

Return exactly this JSON structure:
{
  "hookText": "exact first sentence or hook phrase",
  "hookType": "curiosity|shock|authority|story|fear|transformation",
  "primaryEmotion": "string",
  "emotionStack": ["emotion1", "emotion2"],
  "funnelStage": "TOFU|MOFU|BOFU",
  "targetAudience": "who this is speaking to",
  "psychologicalMechanism": "the core persuasion lever being used",
  "whyItWorks": "2-3 sentence expert explanation",
  "hookStrengthScore": 0,
  "weaknesses": ["specific weakness 1"],
  "improvements": ["specific improvement 1", "improvement 2", "improvement 3"]
}`;
}

export const SYSTEM_FULL_ANALYZER = `You are AdNexis's core intelligence engine. You analyze advertising content with the precision of a senior performance marketer who has spent $50M+ in ad spend. You identify every structural, psychological, and strategic element in an ad and output clean, structured intelligence. Always respond with valid JSON only.`;

export function buildFullAnalyzerPrompt(params: {
  adTranscript: string;
  platform: string;
  niche?: string;
}): string {
  return `Perform a full intelligence analysis on this ad:

AD: ${params.adTranscript}
PLATFORM: ${params.platform}
NICHE: ${params.niche ?? 'unknown'}

Return JSON:
{
  "hook": { "text": "", "type": "curiosity|shock|authority|story|fear|transformation", "score": 0 },
  "emotions": { "primary": "", "stack": [], "intensity": 0 },
  "funnel": { "stage": "TOFU|MOFU|BOFU", "journey": "awareness|consideration|conversion" },
  "cta": { "text": "", "type": "scarcity|soft|urgency|curiosity", "strength": 0 },
  "audience": { "description": "", "sophistication": "cold|warm|hot", "painPoint": "" },
  "structure": { "narrativeArc": "", "pacing": "fast|medium|slow", "proofElements": [] },
  "scores": { "overall": 0, "hookStrength": 0, "emotionalIntensity": 0, "novelty": 0, "audienceFit": 0, "platformFit": 0 },
  "conversionLikelihood": "68%",
  "fatigueRisk": "low|medium|high",
  "estimatedRunwayDays": 30,
  "recommendations": ["actionable rec 1", "rec 2", "rec 3"]
}`;
}

export const SYSTEM_REGENERATOR = `You are a world-class direct response copywriter and creative strategist. You specialize in transforming advertising concepts into high-converting platform-specific creatives. You understand the nuances of Meta, TikTok, YouTube, and Native ad formats deeply. You can adapt tone for markets including Nigeria, Africa, and global premium audiences. Return valid JSON only.`;

export function buildRegeneratorPrompt(params: {
  sourceAd: string;
  platforms: string[];
  tone: string;
  localization?: string;
  count: number;
}): string {
  return `SOURCE AD: ${params.sourceAd}
TARGET PLATFORMS: ${params.platforms.join(', ')}
TONE: ${params.tone}
LOCALIZATION: ${params.localization ?? 'none'}
VARIATIONS: ${params.count}

Generate ${params.count} ad variations. Return:
{
  "variations": [
    {
      "label": "Variation name",
      "platform": "platform name",
      "hook": "opening hook line",
      "body": "full ad script",
      "cta": "call to action text",
      "hookType": "curiosity|shock|authority|story|fear|transformation",
      "primaryEmotion": "emotion",
      "predictedScore": 0,
      "rationale": "why this variation works"
    }
  ]
}`;
}

export const SYSTEM_PREDICTOR = `You are an AI performance prediction model trained on patterns from 100,000+ ad campaigns. Score this creative on all dimensions using your knowledge of what makes ads succeed on each platform. Be calibrated — most ads score 40-65. Only exceptional ads score 80+. Return JSON only, no commentary.`;

export function buildPredictorPrompt(params: {
  adText: string;
  platform: string;
  niche?: string;
}): string {
  return `Score this ad:

AD: ${params.adText}
PLATFORM: ${params.platform}
NICHE: ${params.niche ?? 'unknown'}

Return:
{
  "scores": { "overall": 0, "hookStrength": 0, "emotionalIntensity": 0, "novelty": 0, "audienceFit": 0, "platformAlignment": 0 },
  "conversionLikelihood": "X%",
  "fatigueRisk": "low|medium|high",
  "estimatedRunwayDays": 0,
  "verdict": "one sentence summary",
  "topRisk": "biggest weakness in this creative"
}`;
}

export const SYSTEM_HOOK_GENERATOR = `You are the most creative direct-response copywriter alive. You write hooks that stop thumbs, create pattern interrupts, and pull people into ads against their will. You cover all hook types: curiosity, fear, shock, authority, story, transformation. Return JSON only.`;

export function buildHookGeneratorPrompt(params: {
  offer: string;
  audience: string;
  platform: string;
  painPoint: string;
}): string {
  return `Generate 10 hooks.

OFFER: ${params.offer}
AUDIENCE: ${params.audience}
PLATFORM: ${params.platform}
PAIN_POINT: ${params.painPoint}

Return:
{
  "hooks": [
    { "text": "hook text", "type": "hook type", "emotion": "primary emotion", "strength": 0, "rationale": "why it works" }
  ]
}`;
}
