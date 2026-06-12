import { callOpenRouter, isOpenRouterConfigured, OR_MODELS } from '../ai/openrouter.js';
import type { AdAnalyzerOptions } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LandingPageGenerationInput {
  offer: string;
  audience: string;
  platform: string;
  tone: string;
  keyBenefit: string;
  cta: string;
  niche?: string;
}

export interface LandingPageSection {
  section: string;
  headline: string;
  subheadline?: string;
  bodyText: string;
  ctaText?: string;
}

export interface LandingPageResult {
  hero: LandingPageSection;
  problem: LandingPageSection;
  solution: LandingPageSection;
  socialProof: LandingPageSection;
  cta: LandingPageSection;
  seoTitle: string;
  seoDescription: string;
  generatedBy: 'kimi' | 'hermes' | 'groq' | 'fallback';
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM = `You are an elite direct-response copywriter and conversion optimisation expert.
Generate a complete, high-converting landing page structure for the provided offer.
Every section must be specific, persuasive, and tailored to the exact audience and platform.
Return ONLY valid JSON. No explanation. No markdown.`;

function buildPrompt(input: LandingPageGenerationInput): string {
  return `Generate a complete landing page for:

Offer: ${input.offer}
Target Audience: ${input.audience}
Traffic Source / Platform: ${input.platform}
Tone: ${input.tone}
Key Benefit: ${input.keyBenefit}
CTA: ${input.cta}
${input.niche ? `Niche: ${input.niche}` : ''}

Return ONLY valid JSON:
{
  "hero": {
    "section": "hero",
    "headline": "...",
    "subheadline": "...",
    "bodyText": "...",
    "ctaText": "..."
  },
  "problem": {
    "section": "problem",
    "headline": "...",
    "bodyText": "..."
  },
  "solution": {
    "section": "solution",
    "headline": "...",
    "subheadline": "...",
    "bodyText": "...",
    "ctaText": "..."
  },
  "socialProof": {
    "section": "social_proof",
    "headline": "...",
    "bodyText": "..."
  },
  "cta": {
    "section": "cta",
    "headline": "...",
    "bodyText": "...",
    "ctaText": "..."
  },
  "seoTitle": "...",
  "seoDescription": "..."
}`;
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate a complete landing page using Kimi K2.6 (long-horizon generation).
 * Falls back to Hermes 3 → Groq on failure.
 */
export async function generateLandingPage(
  input: LandingPageGenerationInput,
  opts: AdAnalyzerOptions = {},
): Promise<LandingPageResult> {
  const prompt = buildPrompt(input);

  // Kimi K2.6 — specialised for long-form UI/UX content generation
  if (isOpenRouterConfigured(OR_MODELS.KIMI)) {
    try {
      const result = await callOpenRouter<LandingPageResult>(
        OR_MODELS.KIMI,
        SYSTEM,
        prompt,
        { jsonMode: true, temperature: 0.6, maxTokens: 3000 },
      );
      if (result) return { ...result, generatedBy: 'kimi' };
    } catch { /* fall through */ }
  }

  // Hermes 3 fallback
  if (isOpenRouterConfigured(OR_MODELS.HERMES)) {
    try {
      const result = await callOpenRouter<LandingPageResult>(
        OR_MODELS.HERMES,
        SYSTEM,
        prompt,
        { jsonMode: true, temperature: 0.6, maxTokens: 3000 },
      );
      if (result) return { ...result, generatedBy: 'hermes' };
    } catch { /* fall through */ }
  }

  // Groq last resort
  if (opts.groqApiKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.groqApiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      const content = data.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as LandingPageResult;
      return { ...parsed, generatedBy: 'groq' };
    }
  }

  // Fallback: minimal structural skeleton
  return buildFallback(input);
}

function buildFallback(input: LandingPageGenerationInput): LandingPageResult {
  return {
    hero: { section: 'hero', headline: input.offer, bodyText: input.keyBenefit, ctaText: input.cta },
    problem: { section: 'problem', headline: `Struggling without ${input.keyBenefit}?`, bodyText: 'Many people face this challenge daily.' },
    solution: { section: 'solution', headline: `Introducing: ${input.offer}`, bodyText: `Built for ${input.audience}.`, ctaText: input.cta },
    socialProof: { section: 'social_proof', headline: 'Trusted by thousands', bodyText: 'Join the community that is already benefiting.' },
    cta: { section: 'cta', headline: 'Ready to get started?', bodyText: `${input.audience} — take the next step today.`, ctaText: input.cta },
    seoTitle: input.offer,
    seoDescription: `${input.keyBenefit} for ${input.audience}.`,
    generatedBy: 'fallback',
  };
}
