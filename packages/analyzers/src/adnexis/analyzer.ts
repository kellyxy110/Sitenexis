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

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  temperature = 0.2,
  maxTokens = 1500,
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '{}';
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  temperature = 0.2,
  maxTokens = 1500,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  return data.content[0]?.text ?? '{}';
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

  // Path 2: Claude (explicit key)
  if (opts.anthropicApiKey) {
    try {
      return await callAnthropic(systemPrompt, userPrompt, opts.anthropicApiKey, temperature, maxTokens);
    } catch {
      if (!opts.groqApiKey) throw new Error('All AI providers failed');
    }
  }

  // Path 3: Groq
  if (opts.groqApiKey) {
    return await callGroq(systemPrompt, userPrompt, opts.groqApiKey, temperature, maxTokens);
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
