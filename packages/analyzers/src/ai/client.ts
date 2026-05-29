import OpenAI from 'openai';
import { AI_SYSTEM_PROMPT, parseAIResponse } from './prompts';

// Groq model for all scoring, extraction, and reasoning tasks.
// llama-3.3-70b-versatile: highest capability on Groq, strong instruction following.
export const AI_MODEL = 'llama-3.3-70b-versatile';
/** @deprecated Use AI_MODEL */
export const CLAUDE_MODEL = AI_MODEL;

const MAX_TOKENS = 1_024;
const TEMPERATURE = 0.1; // Near-deterministic — scoring not creative generation

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
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
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

const rateLimiter = new RateLimiter(30);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env['GROQ_API_KEY'] ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}

/**
 * Call the AI scoring API (Groq llama-3.3-70b-versatile) with a user prompt.
 *
 * Enforces strict JSON output via response_format: json_object.
 * Rate-limited to 30 RPM (Groq free tier limit for 70b).
 * Callers must catch errors and return degraded scores — never crash on AI failure.
 */
export async function callAI<T>(
  userPrompt: string,
  systemPrompt: string = AI_SYSTEM_PROMPT,
): Promise<T> {
  await rateLimiter.acquire();

  const client = getClient();

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq API returned empty content for model ${AI_MODEL}`);
  }

  return parseAIResponse<T>(content);
}

/** @deprecated Use callAI */
export const callClaude = callAI;

export { parseAIResponse };
