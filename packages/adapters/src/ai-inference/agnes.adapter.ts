// Agnes adapter — OpenAI-compatible chat completions at apihub.agnes-ai.com/v1.
// Used ONLY as a reasoning layer for the per-audit "SiteNexis Intelligence" assistant.
// It never computes SiteNexis scores/metrics — those remain SiteNexis's source of truth,
// so this adapter is deliberately NOT registered into the scoring fallback chain.

import OpenAI from 'openai';
import type {
  AIInferenceAdapter,
  AICompletionInput,
  AICompletionOutput,
  AIProviderHealth,
} from './interface';

const DEFAULT_BASE_URL = 'https://apihub.agnes-ai.com/v1';
const DEFAULT_MODEL = 'agnes-2.0-flash';

class AgnesAdapter implements AIInferenceAdapter {
  readonly provider = 'agnes';
  readonly supportedModels: readonly string[];

  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly defaultModel: string;
  private _client: OpenAI | null = null;

  constructor(apiKey: string, defaultModel: string = DEFAULT_MODEL, baseURL: string = DEFAULT_BASE_URL) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.baseURL = baseURL;
    this.supportedModels = [defaultModel];
  }

  isConfigured(): boolean {
    return this.apiKey.length > 10;
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        defaultHeaders: { 'X-Title': 'SiteNexis Intelligence' },
      });
    }
    return this._client;
  }

  async complete(input: AICompletionInput): Promise<AICompletionOutput> {
    const start = Date.now();
    const timeoutMs = input.ctx?.timeoutMs ?? 30_000;
    const model = input.model || this.defaultModel;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ];

      const response = await this.client.chat.completions.create(
        {
          model,
          messages,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 1_024,
          ...(input.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: controller.signal },
      );

      const content = response.choices[0]?.message?.content ?? '';
      if (!content) throw new Error(`Agnes returned empty content for model ${model}`);

      const inputTokens = response.usage?.prompt_tokens;
      const outputTokens = response.usage?.completion_tokens;
      return {
        content,
        model: response.model ?? model,
        provider: 'agnes',
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
      return { provider: 'agnes', status: 'unavailable', latencyMs: 0, checkedAt: new Date(), details: 'API key not configured' };
    }
    return { provider: 'agnes', status: 'healthy', latencyMs: 0, checkedAt: new Date() };
  }
}

// ── Factory — one instance per (apiKey + model + baseURL) ──────────────────────
const _adapters = new Map<string, AgnesAdapter>();

export function getAgnesAdapter(apiKey: string, model?: string, baseURL?: string): AgnesAdapter {
  const m = model || DEFAULT_MODEL;
  const b = baseURL || DEFAULT_BASE_URL;
  const cacheKey = `${m}:${b}:${apiKey.slice(0, 8)}`;
  if (!_adapters.has(cacheKey)) {
    _adapters.set(cacheKey, new AgnesAdapter(apiKey, m, b));
  }
  return _adapters.get(cacheKey)!;
}

export const DEFAULT_AGNES_MODEL = DEFAULT_MODEL;
export const DEFAULT_AGNES_BASE_URL = DEFAULT_BASE_URL;
export { AgnesAdapter };
