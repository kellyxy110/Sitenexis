// Anthropic adapter — uses REST directly (no @anthropic-ai/sdk dependency).
// Currently used only by packages/analyzers/src/adnexis/ which accepts an explicit apiKey
// from the caller rather than reading from env.

import type {
  AIInferenceAdapter,
  AICompletionInput,
  AICompletionOutput,
  AIProviderHealth,
} from './interface';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

class AnthropicAdapter implements AIInferenceAdapter {
  readonly provider = 'anthropic';
  readonly supportedModels = [
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
  ] as const;

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 10;
  }

  async complete(input: AICompletionInput): Promise<AICompletionOutput> {
    const start = Date.now();
    const timeoutMs = input.ctx?.timeoutMs ?? 30_000;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 1_500,
        temperature: input.temperature ?? 0.2,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.userPrompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };

    const content = data.content[0]?.text ?? '';

    const inputTokens = data.usage?.input_tokens;
    const outputTokens = data.usage?.output_tokens;
    return {
      content,
      model: data.model ?? input.model,
      provider: 'anthropic',
      latencyMs: Date.now() - start,
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    if (!this.isConfigured()) {
      return {
        provider: 'anthropic',
        status: 'unavailable',
        latencyMs: 0,
        checkedAt: new Date(),
        details: 'API key not configured',
      };
    }
    return { provider: 'anthropic', status: 'healthy', latencyMs: 0, checkedAt: new Date() };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

let _envInstance: AnthropicAdapter | null = null;

/** Adapter using ANTHROPIC_API_KEY from environment */
export function getAnthropicAdapter(): AnthropicAdapter {
  if (!_envInstance) {
    _envInstance = new AnthropicAdapter(process.env['ANTHROPIC_API_KEY'] ?? '');
  }
  return _envInstance;
}

/** Adapter using a caller-supplied key (adnexis pattern — key passed at runtime) */
export function makeAnthropicAdapter(apiKey: string): AnthropicAdapter {
  return new AnthropicAdapter(apiKey);
}

export { AnthropicAdapter };
