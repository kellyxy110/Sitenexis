import { callOpenRouterVision, isOpenRouterConfigured, OR_MODELS } from '../ai/openrouter.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdVisualReviewInput {
  adImageBase64OrUrl: string;
  platform: string;
  niche?: string;
}

export interface AdVisualReviewResult {
  overallScore: number;                   // 0–100
  hookStrengthScore: number;              // 0–100 — does the visual stop the scroll?
  brandClarityScore: number;              // 0–100 — is the brand/offer immediately clear?
  ctaVisibilityScore: number;             // 0–100 — is the CTA prominent and actionable?
  audienceAlignmentScore: number;         // 0–100 — does the visual match the target audience?
  issues: AdVisualIssue[];
  suggestions: string[];
  analysisSource: 'gemma4' | 'skipped';
}

export interface AdVisualIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendation: string;
}

interface GemmaAdResponse {
  hookStrengthScore: number;
  brandClarityScore: number;
  ctaVisibilityScore: number;
  audienceAlignmentScore: number;
  issues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
    recommendation: string;
  }>;
  suggestions: string[];
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM = `You are an expert ad creative analyst specialising in performance advertising.
You evaluate ad creatives for scroll-stopping power, brand clarity, CTA effectiveness, and audience fit.
Return ONLY valid JSON. No explanation. No markdown.`;

function buildPrompt(input: AdVisualReviewInput): string {
  return `Analyse this ad creative for performance potential.

Platform: ${input.platform}
${input.niche ? `Niche: ${input.niche}` : ''}

Evaluate (each 0-100):
1. Hook Strength — Does this visual immediately stop scrolling? Is the main message instantly clear?
2. Brand Clarity — Is the brand or offer visually prominent and unmistakable?
3. CTA Visibility — Is the call-to-action button/text visible, high-contrast, and compelling?
4. Audience Alignment — Does the visual aesthetic, style, and message match the expected audience?

Return ONLY valid JSON:
{
  "hookStrengthScore": 80,
  "brandClarityScore": 75,
  "ctaVisibilityScore": 60,
  "audienceAlignmentScore": 85,
  "issues": [
    {
      "type": "low_cta_contrast",
      "severity": "warning",
      "description": "CTA button blends into background colour",
      "recommendation": "Increase CTA button contrast ratio to at least 4.5:1"
    }
  ],
  "suggestions": ["Add urgency language to the headline", "Test a darker CTA button colour"]
}`;
}

// ─── Reviewer ─────────────────────────────────────────────────────────────────

const SKIPPED: AdVisualReviewResult = {
  overallScore: 0,
  hookStrengthScore: 0,
  brandClarityScore: 0,
  ctaVisibilityScore: 0,
  audienceAlignmentScore: 0,
  issues: [],
  suggestions: [],
  analysisSource: 'skipped',
};

/**
 * Analyse an ad creative image using Gemma 4 31B multimodal.
 * Returns a `skipped` result if no image or Gemma is not configured.
 */
export async function reviewAdVisual(
  input: AdVisualReviewInput,
): Promise<AdVisualReviewResult> {
  if (!input.adImageBase64OrUrl) return SKIPPED;
  if (!isOpenRouterConfigured(OR_MODELS.GEMMA)) return SKIPPED;

  try {
    const result = await callOpenRouterVision<GemmaAdResponse>(
      OR_MODELS.GEMMA,
      SYSTEM,
      buildPrompt(input),
      input.adImageBase64OrUrl,
      { jsonMode: true, maxTokens: 1024 },
    );

    if (!result) return SKIPPED;

    const hss = clamp(result.hookStrengthScore ?? 0);
    const bcs = clamp(result.brandClarityScore ?? 0);
    const cvs = clamp(result.ctaVisibilityScore ?? 0);
    const aas = clamp(result.audienceAlignmentScore ?? 0);
    const overallScore = Math.round((hss + bcs + cvs + aas) / 4);

    return {
      overallScore,
      hookStrengthScore: hss,
      brandClarityScore: bcs,
      ctaVisibilityScore: cvs,
      audienceAlignmentScore: aas,
      issues: result.issues ?? [],
      suggestions: result.suggestions ?? [],
      analysisSource: 'gemma4',
    };
  } catch (err) {
    console.error('[visual-review] Gemma 4 ad review failed (non-fatal):', err instanceof Error ? err.message : String(err));
    return SKIPPED;
  }
}

function clamp(val: number): number {
  return Math.min(100, Math.max(0, Math.round(val)));
}
