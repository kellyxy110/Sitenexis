import type { AdAnalysisResult, HookAnalysisResult, PerformancePrediction, HookGenerationResult, AdAnalyzerOptions } from './types.js';
import {
  SYSTEM_FULL_ANALYZER,
  SYSTEM_HOOK_ANALYZER,
  SYSTEM_PREDICTOR,
  SYSTEM_HOOK_GENERATOR,
  buildFullAnalyzerPrompt,
  buildHookAnalyzerPrompt,
  buildPredictorPrompt,
  buildHookGeneratorPrompt,
} from './prompts.js';
import { callOpenRouter, isOpenRouterConfigured, OR_MODELS } from '../ai/openrouter.js';
import { makeGroqAdapter, makeAnthropicAdapter } from '@sitenexis/adapters';

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Try an OpenRouter model call, return null on failure.
 */
async function tryOpenRouter<T>(
  model: (typeof OR_MODELS)[keyof typeof OR_MODELS],
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
): Promise<T | null> {
  if (!isOpenRouterConfigured(model)) return null;
  try {
    return await callOpenRouter<T>(model, systemPrompt, userPrompt, {
      jsonMode: true,
      temperature,
      maxTokens,
    });
  } catch {
    return null;
  }
}

/**
 * AI call with full routing chain:
 *   1. Hermes 3 405B (OpenRouter) — best structured JSON + function calling
 *   2. Anthropic Claude (if key provided)
 *   3. Groq (if key provided)
 */
async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: AdAnalyzerOptions,
  temperature = 0.2,
  maxTokens = 1500,
): Promise<string> {
  // Path 1: Hermes 3 405B — superior structured output for ad analysis
  const hermesResult = await tryOpenRouter<Record<string, unknown>>(
    OR_MODELS.HERMES,
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens,
  );
  if (hermesResult) return JSON.stringify(hermesResult);

  // Path 2: Anthropic (explicit key)
  if (opts.anthropicApiKey) {
    try {
      const output = await makeAnthropicAdapter(opts.anthropicApiKey).complete({
        systemPrompt,
        userPrompt,
        model: 'claude-sonnet-4-6',
        maxTokens,
        temperature,
      });
      return output.content;
    } catch {
      if (!opts.groqApiKey) throw new Error('All AI providers failed');
    }
  }

  // Path 3: Groq (explicit key)
  if (opts.groqApiKey) {
    const output = await makeGroqAdapter(opts.groqApiKey).complete({
      systemPrompt,
      userPrompt,
      model: 'llama-3.1-70b-versatile',
      maxTokens,
      temperature,
      jsonMode: true,
    });
    return output.content;
  }

  throw new Error('No AI provider configured — set OPENROUTER_API_KEY or GROQ_API_KEY');
}

/**
 * Performance prediction uses DeepSeek V4 Flash with reasoning — optimised for
 * multi-factor prediction tasks requiring analytical depth.
 */
async function callAIForPrediction(
  systemPrompt: string,
  userPrompt: string,
  opts: AdAnalyzerOptions,
): Promise<string> {
  // DeepSeek with reasoning for performance prediction
  const deepResult = await tryOpenRouter<Record<string, unknown>>(
    OR_MODELS.DEEPSEEK,
    systemPrompt,
    userPrompt,
    0.0,
    1000,
  );
  if (deepResult) return JSON.stringify(deepResult);

  // Fall back to standard routing
  return callAI(systemPrompt, userPrompt, opts, 0.0, 800);
}

export async function analyzeAdFull(
  params: { adTranscript: string; platform: string; niche?: string },
  opts: AdAnalyzerOptions,
): Promise<AdAnalysisResult> {
  const text = await callAI(
    SYSTEM_FULL_ANALYZER,
    buildFullAnalyzerPrompt(params),
    opts,
    0.1,
    2500,
  );
  return parseJson<AdAnalysisResult>(text);
}

export async function analyzeHook(
  params: { adContent: string; platform: string; niche?: string },
  opts: AdAnalyzerOptions,
): Promise<HookAnalysisResult> {
  const text = await callAI(
    SYSTEM_HOOK_ANALYZER,
    buildHookAnalyzerPrompt(params),
    opts,
    0.2,
    1500,
  );
  return parseJson<HookAnalysisResult>(text);
}

export async function predictPerformance(
  params: { adText: string; platform: string; niche?: string },
  opts: AdAnalyzerOptions,
): Promise<PerformancePrediction> {
  const text = await callAIForPrediction(
    SYSTEM_PREDICTOR,
    buildPredictorPrompt(params),
    opts,
  );
  return parseJson<PerformancePrediction>(text);
}

export async function generateHooks(
  params: { offer: string; audience: string; platform: string; painPoint: string },
  opts: AdAnalyzerOptions,
): Promise<HookGenerationResult> {
  const text = await callAI(
    SYSTEM_HOOK_GENERATOR,
    buildHookGeneratorPrompt(params),
    opts,
    0.9,
    1500,
  );
  return parseJson<HookGenerationResult>(text);
}
