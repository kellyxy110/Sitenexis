// OpenAI adapter — real OpenAI API (not via OpenRouter or Groq).
// Used exclusively for the citation-check tool which requires gpt-4o-search-preview
// with the web_search_preview tool (Responses API).

import OpenAI from 'openai';
import type {
  AIInferenceAdapter,
  AICompletionInput,
  AICompletionOutput,
  AIProviderHealth,
} from './interface';

/** Result of a Responses API call — includes web citations */
export interface OpenAIWebSearchOutput extends AICompletionOutput {
  citations: string[];
}

class OpenAIAdapter implements AIInferenceAdapter {
  readonly provider = 'openai';
  readonly supportedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-search-preview'] as const;

  private readonly apiKey: string;
  private _client: OpenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 10;
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async complete(input: AICompletionInput): Promise<AICompletionOutput> {
    const start = Date.now();
    const response = await this.client.chat.completions.create({
      model: input.model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxTokens ?? 1_024,
      ...(input.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });
    const content = response.choices[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens;
    const outputTokens = response.usage?.completion_tokens;
    return {
      content,
      model: input.model,
      provider: 'openai',
      latencyMs: Date.now() - start,
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    };
  }

  /**
   * Responses API — used for gpt-4o-search-preview with web_search_preview tool.
   * Returns the generated text and any URL citations found in annotations.
   */
  async webSearch(query: string, model = 'gpt-4o-search-preview'): Promise<OpenAIWebSearchOutput> {
    const start = Date.now();
    const response = await this.client.responses.create({
      model,
      tools: [{ type: 'web_search_preview' as const }],
      input: query,
    });

    let text = '';
    const citations: string[] = [];

    for (const item of response.output) {
      if (item.type === 'message') {
        for (const block of item.content) {
          if (block.type === 'output_text') {
            text += block.text;
            for (const ann of block.annotations ?? []) {
              if (ann.type === 'url_citation' && 'url' in ann && typeof ann.url === 'string') {
                citations.push(ann.url);
              }
            }
          }
        }
      }
    }

    return {
      content: text,
      citations,
      model,
      provider: 'openai',
      latencyMs: Date.now() - start,
    };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    if (!this.isConfigured()) {
      return {
        provider: 'openai',
        status: 'unavailable',
        latencyMs: 0,
        checkedAt: new Date(),
        details: 'OPENAI_API_KEY not configured',
      };
    }
    return { provider: 'openai', status: 'healthy', latencyMs: 0, checkedAt: new Date() };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance: OpenAIAdapter | null = null;

export function getOpenAIAdapter(): OpenAIAdapter {
  if (!_instance) {
    _instance = new OpenAIAdapter(process.env['OPENAI_API_KEY'] ?? '');
  }
  return _instance;
}

export { OpenAIAdapter };
