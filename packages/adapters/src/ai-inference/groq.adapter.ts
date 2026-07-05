// Groq adapter — the only file in the codebase that imports the openai SDK for Groq.
// Uses OpenAI-compatible endpoint at api.groq.com.
// All direct OpenAI SDK calls for Groq are centralized here.

import OpenAI from 'openai';
import type {
  AIInferenceAdapter,
  AICompletionInput,
  AICompletionOutput,
  AIProviderHealth,
} from './interface';

class GroqAdapter implements AIInferenceAdapter {
  readonly provider = 'groq';
  readonly supportedModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
  ] as const;

  private readonly apiKey: string;
  private _client: OpenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 10 && !this.apiKey.includes('placeholder');
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
    return this._client;
  }

  async complete(input: AICompletionInput): Promise<AICompletionOutput> {
    const start = Date.now();
    const timeoutMs = input.ctx?.timeoutMs ?? 30_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: input.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          temperature: input.temperature ?? 0.1,
          max_tokens: input.maxTokens ?? 1_024,
          ...(input.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: controller.signal },
      );

      const content = response.choices[0]?.message?.content ?? '';
      if (!content) throw new Error(`Groq returned empty content for model ${input.model}`);

      const inputTokens = response.usage?.prompt_tokens;
      const outputTokens = response.usage?.completion_tokens;
      return {
        content,
        model: response.model ?? input.model,
        provider: 'groq',
        latencyMs: Date.now() - start,
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<AIProviderHealth> {
    if (!this.isConfigured()) {
      return {
        provider: 'groq',
        status: 'unavailable',
        latencyMs: 0,
        checkedAt: new Date(),
        details: 'GROQ_API_KEY not configured',
      };
    }
    const start = Date.now();
    try {
      await this.client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
        temperature: 0,
      });
      const latencyMs = Date.now() - start;
      return {
        provider: 'groq',
        status: latencyMs > 8_000 ? 'degraded' : 'healthy',
        latencyMs,
        checkedAt: new Date(),
      };
    } catch (err) {
      return {
        provider: 'groq',
        status: 'unavailable',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ── Singletons ────────────────────────────────────────────────────────────────

let _standard: GroqAdapter | null = null;
let _fast: GroqAdapter | null = null;

/**
 * Standard Groq adapter — llama-3.3-70b-versatile.
 * Used by callAI() as the Groq fallback path.
 */
export function getGroqAdapter(): GroqAdapter {
  if (!_standard) {
    _standard = new GroqAdapter(process.env['GROQ_API_KEY'] ?? '');
  }
  return _standard;
}

/**
 * Fast Groq adapter — llama-3.1-8b-instant.
 * Used for high-throughput low-latency tasks: entity extraction Stage 1, fix generation.
 */
export function getGroqFastAdapter(): GroqAdapter {
  if (!_fast) {
    _fast = new GroqAdapter(process.env['GROQ_API_KEY'] ?? '');
  }
  return _fast;
}

// Named adapter for callers that pass their own key (adnexis, fixes)
export function makeGroqAdapter(apiKey: string): GroqAdapter {
  return new GroqAdapter(apiKey);
}

export { GroqAdapter };
