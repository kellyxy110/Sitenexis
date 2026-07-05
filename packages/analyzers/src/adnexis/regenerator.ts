import type { RegenerationResult, AdAnalyzerOptions } from './types.js';
import { SYSTEM_REGENERATOR, buildRegeneratorPrompt } from './prompts.js';
import { callOpenRouter, isOpenRouterConfigured, OR_MODELS } from '../ai/openrouter.js';
import { makeAnthropicAdapter, makeGroqAdapter } from '@sitenexis/adapters';

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: AdAnalyzerOptions,
): Promise<string> {
  // Kimi K2.6 — long-horizon generation, ideal for multi-variant ad creation
  if (isOpenRouterConfigured(OR_MODELS.KIMI)) {
    try {
      const result = await callOpenRouter<Record<string, unknown>>(
        OR_MODELS.KIMI,
        systemPrompt,
        userPrompt,
        { jsonMode: true, temperature: 0.7, maxTokens: 3000 },
      );
      if (result) return JSON.stringify(result);
    } catch { /* fall through */ }
  }

  // Hermes 3 — creative generation fallback
  if (isOpenRouterConfigured(OR_MODELS.HERMES)) {
    try {
      const result = await callOpenRouter<Record<string, unknown>>(
        OR_MODELS.HERMES,
        systemPrompt,
        userPrompt,
        { jsonMode: true, temperature: 0.7, maxTokens: 3000 },
      );
      if (result) return JSON.stringify(result);
    } catch { /* fall through */ }
  }

  // Anthropic fallback (explicit key)
  if (opts.anthropicApiKey) {
    try {
      const output = await makeAnthropicAdapter(opts.anthropicApiKey).complete({
        systemPrompt,
        userPrompt,
        model: 'claude-sonnet-4-6',
        maxTokens: 3000,
        temperature: 0.7,
      });
      return output.content;
    } catch { /* fall through to groq */ }
  }

  // Groq last resort
  if (opts.groqApiKey) {
    const output = await makeGroqAdapter(opts.groqApiKey).complete({
      systemPrompt,
      userPrompt,
      model: 'llama-3.1-70b-versatile',
      maxTokens: 3000,
      temperature: 0.7,
      jsonMode: true,
    });
    return output.content;
  }

  throw new Error('No AI provider configured — set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY');
}

export async function regenerateAd(
  params: {
    sourceAd: string;
    platforms: string[];
    tone: string;
    localization?: string;
    count: number;
  },
  opts: AdAnalyzerOptions,
): Promise<RegenerationResult> {
  const text = await callAI(SYSTEM_REGENERATOR, buildRegeneratorPrompt(params), opts);
  return parseJson<RegenerationResult>(text);
}
