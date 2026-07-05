// OpenRouter multi-model router for @sitenexis/analyzers.
// No provider SDK imported here — delegates to @sitenexis/adapters OpenRouterAdapter.
// Rate limiting and per-model key lookup live here (business config, not infra).

import { getOpenRouterAdapter } from '@sitenexis/adapters';
import { parseAIResponse } from './prompts';

// ─── Model registry ───────────────────────────────────────────────────────────

export const OR_MODELS = {
  HERMES:   'nousresearch/hermes-3-llama-3.1-405b:free',
  DEEPSEEK: 'deepseek/deepseek-v4-flash:free',
  GEMMA:    'google/gemma-4-31b-it:free',
  QWEN:     'qwen/qwen3-next-80b-a3b-instruct:free',
  KIMI:     'moonshotai/kimi-k2.6:free',
  LLAMA:    'meta-llama/llama-3.3-70b-instruct:free',
} as const;

export type OpenRouterModel = (typeof OR_MODELS)[keyof typeof OR_MODELS];

// ─── Per-model API key lookup ─────────────────────────────────────────────────

function getKeyForModel(model: OpenRouterModel): string {
  const keyMap: Record<OpenRouterModel, string> = {
    [OR_MODELS.HERMES]:   process.env['OPENROUTER_HERMES_KEY']   ?? process.env['OPENROUTER_API_KEY'] ?? '',
    [OR_MODELS.DEEPSEEK]: process.env['OPENROUTER_DEEPSEEK_KEY'] ?? process.env['OPENROUTER_API_KEY'] ?? '',
    [OR_MODELS.GEMMA]:    process.env['OPENROUTER_GEMMA_KEY']    ?? process.env['OPENROUTER_API_KEY'] ?? '',
    [OR_MODELS.QWEN]:     process.env['OPENROUTER_QWEN_KEY']     ?? process.env['OPENROUTER_API_KEY'] ?? '',
    [OR_MODELS.KIMI]:     process.env['OPENROUTER_KIMI_KEY']     ?? process.env['OPENROUTER_API_KEY'] ?? '',
    [OR_MODELS.LLAMA]:    process.env['OPENROUTER_LLAMA_KEY']    ?? process.env['OPENROUTER_API_KEY'] ?? '',
  };
  return keyMap[model];
}

export function isOpenRouterConfigured(model: OpenRouterModel): boolean {
  return getKeyForModel(model).length > 10;
}

// ─── Rate limiter — 10 RPM per model for free tier ───────────────────────────

class ModelRateLimiter {
  private readonly limiters = new Map<OpenRouterModel, { tokens: number; lastRefill: number }>();
  private readonly rpmLimit = 10;

  async acquire(model: OpenRouterModel): Promise<void> {
    if (!this.limiters.has(model)) {
      this.limiters.set(model, { tokens: this.rpmLimit, lastRefill: Date.now() });
    }
    const state = this.limiters.get(model)!;
    const intervalMs = 60_000 / this.rpmLimit;

    while (true) {
      const elapsed = Date.now() - state.lastRefill;
      const refill = Math.floor(elapsed / intervalMs);
      if (refill > 0) {
        state.tokens = Math.min(this.rpmLimit, state.tokens + refill);
        state.lastRefill = Date.now();
      }
      if (state.tokens >= 1) { state.tokens -= 1; return; }
      await new Promise<void>((r) => setTimeout(r, intervalMs));
    }
  }
}

const rateLimiter = new ModelRateLimiter();

// ─── Options ──────────────────────────────────────────────────────────────────

export interface OpenRouterOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  reasoning?: 'high' | 'xhigh';
}

// ─── Text completion ──────────────────────────────────────────────────────────

export async function callOpenRouter<T>(
  model: OpenRouterModel,
  systemPrompt: string,
  userPrompt: string,
  opts: OpenRouterOptions = {},
): Promise<T> {
  const apiKey = getKeyForModel(model);
  if (!apiKey) throw new Error(`No API key configured for model ${model}`);

  await rateLimiter.acquire(model);

  const output = await getOpenRouterAdapter(model, apiKey).complete({
    systemPrompt,
    userPrompt,
    model,
    temperature: opts.temperature ?? 0.1,
    maxTokens: opts.maxTokens ?? 2_048,
    ...(opts.jsonMode !== undefined ? { jsonMode: opts.jsonMode } : {}),
  });

  // Normalise JSON output — strip any code fences the model may have added
  if (opts.jsonMode || output.content.trimStart().startsWith('{') || output.content.trimStart().startsWith('[')) {
    return parseAIResponse<T>(output.content);
  }

  return output.content as unknown as T;
}

// ─── Vision completion ────────────────────────────────────────────────────────

export async function callOpenRouterVision<T>(
  model: typeof OR_MODELS.GEMMA | typeof OR_MODELS.KIMI,
  systemPrompt: string,
  textPrompt: string,
  imageBase64OrUrl: string,
  opts: OpenRouterOptions = {},
): Promise<T> {
  const apiKey = getKeyForModel(model);
  if (!apiKey) throw new Error(`No API key configured for model ${model}`);

  await rateLimiter.acquire(model);

  const output = await getOpenRouterAdapter(model, apiKey).complete({
    systemPrompt,
    userPrompt: textPrompt,
    model,
    temperature: opts.temperature ?? 0.1,
    maxTokens: opts.maxTokens ?? 2_048,
    imageUrl: imageBase64OrUrl,
    ...(opts.jsonMode !== undefined ? { jsonMode: opts.jsonMode } : {}),
  });

  if (opts.jsonMode || output.content.trimStart().startsWith('{')) {
    return parseAIResponse<T>(output.content);
  }

  return output.content as unknown as T;
}
