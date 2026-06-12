import OpenAI from 'openai';
import { AI_SYSTEM_PROMPT, parseAIResponse } from './prompts';
import { routeTask, isAnyOpenRouterAvailable } from './model-router';

// Legacy constant — Groq remains the fast fallback path
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

let _groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!_groqClient) {
    _groqClient = new OpenAI({
      apiKey: process.env['GROQ_API_KEY'] ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groqClient;
}

async function callGroqDirect<T>(userPrompt: string, systemPrompt: string): Promise<T> {
  await groqRateLimiter.acquire();
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    max_tokens: GROQ_MAX_TOKENS,
    temperature: TEMPERATURE,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`Groq API returned empty content for model ${AI_MODEL}`);
  return parseAIResponse<T>(content);
}

/**
 * Primary AI scoring function.
 *
 * Routing strategy:
 *   1. Hermes 3 405B (OpenRouter) — best structured JSON, agentic, 405B quality
 *   2. Groq llama-3.3-70b-versatile — fast fallback, always available
 *
 * The caller never needs to know which model ran — the interface is identical.
 */
export async function callAI<T>(
  userPrompt: string,
  systemPrompt: string = AI_SYSTEM_PROMPT,
): Promise<T> {
  // Try Hermes 3 first — superior structured output at 405B scale
  if (isAnyOpenRouterAvailable()) {
    try {
      const result = await routeTask<T>('structured_scoring', systemPrompt, userPrompt, {
        jsonMode: true,
        maxTokens: 2048,
        temperature: TEMPERATURE,
      });
      if (result !== null) return result;
    } catch {
      // Fall through to Groq
    }
  }

  // Groq fallback — always available, near-deterministic, low latency
  return callGroqDirect<T>(userPrompt, systemPrompt);
}

/** @deprecated Use callAI */
export const callClaude = callAI;

export { parseAIResponse };
