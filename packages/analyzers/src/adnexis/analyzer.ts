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

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned) as T;
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

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: AdAnalyzerOptions,
  temperature = 0.2,
  maxTokens = 1500,
): Promise<string> {
  if (opts.anthropicApiKey) {
    try {
      return await callAnthropic(systemPrompt, userPrompt, opts.anthropicApiKey, temperature, maxTokens);
    } catch {
      if (!opts.groqApiKey) throw new Error('Both AI providers failed');
    }
  }
  if (opts.groqApiKey) {
    return await callGroq(systemPrompt, userPrompt, opts.groqApiKey, temperature, maxTokens);
  }
  throw new Error('No AI provider configured');
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
  const text = await callAI(
    SYSTEM_PREDICTOR,
    buildPredictorPrompt(params),
    opts,
    0.0,
    800,
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
