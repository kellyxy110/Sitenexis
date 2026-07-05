// OpenRouter adapter — the only file in the codebase that imports the openai SDK for OpenRouter.
// Uses OpenAI-compatible endpoint at openrouter.ai/api/v1.
// Supports both text and vision (multimodal) completions.

import OpenAI from 'openai';
import type {
  AIInferenceAdapter,
  AICompletionInput,
  AICompletionOutput,
  AIProviderHealth,
} from './interface';

class OpenRouterAdapter implements AIInferenceAdapter {
  readonly provider = 'openrouter';
  readonly supportedModels: readonly string[];

  private readonly apiKey: string;
  private readonly defaultModel: string;
  private _client: OpenAI | null = null;

  constructor(apiKey: string, defaultModel: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.supportedModels = [defaultModel];
  }

  isConfigured(): boolean {
    return this.apiKey.length > 10;
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://sitenexis.com',
          'X-Title': 'SiteNexis AI Intelligence Platform',
        },
      });
    }
    return this._client;
  }

  async complete(input: AICompletionInput): Promise<AICompletionOutput> {
    const start = Date.now();
    const timeoutMs = input.ctx?.timeoutMs ?? 30_000;
    const model = input.model ?? this.defaultModel;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: input.systemPrompt },
      ];

      if (input.imageUrl) {
        const imageContent = input.imageUrl.startsWith('http')
          ? { type: 'image_url' as const, image_url: { url: input.imageUrl } }
          : { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${input.imageUrl}` } };
        messages.push({
          role: 'user',
          content: [imageContent, { type: 'text' as const, text: input.userPrompt }],
        });
      } else {
        messages.push({ role: 'user', content: input.userPrompt });
      }

      const response = await this.client.chat.completions.create(
        {
          model,
          messages,
          temperature: input.temperature ?? 0.1,
          max_tokens: input.maxTokens ?? 2_048,
          ...(input.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: controller.signal },
      );

      const content = response.choices[0]?.message?.content ?? '';
      if (!content) throw new Error(`OpenRouter returned empty content for model ${model}`);

      const inputTokens = response.usage?.prompt_tokens;
      const outputTokens = response.usage?.completion_tokens;
      return {
        content,
        model: response.model ?? model,
        provider: 'openrouter',
        latencyMs: Date.now() - start,
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<AIProviderHealth> {
    // Avoid probing free-tier models unnecessarily — check key presence only
    if (!this.isConfigured()) {
      return {
        provider: 'openrouter',
        status: 'unavailable',
        latencyMs: 0,
        checkedAt: new Date(),
        details: 'API key not configured',
      };
    }
    return { provider: 'openrouter', status: 'healthy', latencyMs: 0, checkedAt: new Date() };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────
// One adapter instance per (apiKey + model) pair.

const _adapters = new Map<string, OpenRouterAdapter>();

export function getOpenRouterAdapter(model: string, apiKey: string): OpenRouterAdapter {
  const cacheKey = `${model}:${apiKey.slice(0, 8)}`;
  if (!_adapters.has(cacheKey)) {
    _adapters.set(cacheKey, new OpenRouterAdapter(apiKey, model));
  }
  return _adapters.get(cacheKey)!;
}

export { OpenRouterAdapter };
