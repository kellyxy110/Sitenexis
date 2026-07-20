// Primary AI inference entry point for all analyzer modules.
// No provider SDK is imported here — all calls go through @sitenexis/adapters.
//
// Routing strategy:
//   1. OpenRouter Hermes 3 405B — best structured JSON, used via routeTask()
//   2. Groq llama-3.3-70b-versatile — fast fallback, always available

import { getGroqAdapter } from '@sitenexis/adapters';
import { AI_SYSTEM_PROMPT, parseAIResponse } from './prompts';
import { routeTask, isAnyOpenRouterAvailable } from './model-router';
import { emitAiCall } from './telemetry';

export const AI_MODEL = 'llama-3.3-70b-versatile';
/** @deprecated Use AI_MODEL */
export const CLAUDE_MODEL = AI_MODEL;

const GROQ_MAX_TOKENS = 1_024;
const TEMPERATURE = 0.1;

// Groq free tier: 30 RPM for llama-3.3-70b-versatile
class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number;
  private lastRefill: number;

  constructor(requestsPerMinute: number) {
    this.capacity = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillIntervalMs = 60_000 / requestsPerMinute;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) { this.tokens -= 1; return; }
      await sleep(this.refillIntervalMs);
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.refillIntervalMs);
    if (newTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}

const groqRateLimiter = new RateLimiter(30);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroqDirect<T>(
  userPrompt: string,
  systemPrompt: string,
  maxTokens: number = GROQ_MAX_TOKENS,
): Promise<T> {
  await groqRateLimiter.acquire();
  const callStart = Date.now();
  try {
    const output = await getGroqAdapter().complete({
      systemPrompt,
      userPrompt,
      model: AI_MODEL,
      maxTokens,
      temperature: TEMPERATURE,
      jsonMode: true,
    });
    emitAiCall({
      provider: output.provider,
      model: output.model,
      latencyMs: output.latencyMs,
      success: true,
      ...(output.inputTokens !== undefined ? { inputTokens: output.inputTokens } : {}),
      ...(output.outputTokens !== undefined ? { outputTokens: output.outputTokens } : {}),
    });
    return parseAIResponse<T>(output.content);
  } catch (err) {
    emitAiCall({
      provider: 'groq',
      model: AI_MODEL,
      latencyMs: Date.now() - callStart,
      success: false,
      errorCode: err instanceof Error ? err.message.slice(0, 64) : 'unknown',
    });
    throw err;
  }
}

/**
 * Primary AI scoring function.
 * Routing strategy:
 *   1. OpenRouter Hermes 3 405B — best structured JSON at 405B scale
 *   2. Groq llama-3.3-70b-versatile — fast fallback, always available
 *
 * The caller never needs to know which model ran.
 */
export async function callAI<T>(
  userPrompt: string,
  systemPrompt: string = AI_SYSTEM_PROMPT,
  maxTokens: number = GROQ_MAX_TOKENS,
): Promise<T> {
  if (isAnyOpenRouterAvailable()) {
    try {
      const result = await routeTask<T>('structured_scoring', systemPrompt, userPrompt, {
        jsonMode: true,
        maxTokens: Math.max(maxTokens, 2_048),
        temperature: TEMPERATURE,
      });
      if (result !== null) return result;
    } catch {
      // Fall through to Groq
    }
  }

  return callGroqDirect<T>(userPrompt, systemPrompt, maxTokens);
}

/** @deprecated Use callAI */
export const callClaude = callAI;

export { parseAIResponse };
