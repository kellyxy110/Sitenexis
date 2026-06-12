import OpenAI from 'openai';

// ─── Model registry ───────────────────────────────────────────────────────────

export const OR_MODELS = {
  // 405B full finetune — best structured JSON output + function calling
  HERMES:   'nousresearch/hermes-3-llama-3.1-405b:free',
  // 284B MoE, 1M context, reasoning modes (high/xhigh) — whole-site analysis
  DEEPSEEK: 'deepseek/deepseek-v4-flash:free',
  // 31B multimodal (text + image), 256K context, thinking mode — visual analysis
  GEMMA:    'google/gemma-4-31b-it:free',
  // 80B MoE, ultra-long context, deterministic — RAG simulation + throughput
  QWEN:     'qwen/qwen3-next-80b-a3b-instruct:free',
  // Long-horizon coding + UI/UX generation + agent swarm — code + landing pages
  KIMI:     'moonshotai/kimi-k2.6:free',
  // 70B multilingual (8 languages) — non-English site analysis
  LLAMA:    'meta-llama/llama-3.3-70b-instruct:free',
} as const;

export type OpenRouterModel = (typeof OR_MODELS)[keyof typeof OR_MODELS];

// ─── Per-model API key lookup ────────────────────────────────────────────────

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
  const key = getKeyForModel(model);
  return key.length > 10;
}

// ─── Client factory ───────────────────────────────────────────────────────────

const _clients = new Map<string, OpenAI>();

function getClient(apiKey: string): OpenAI {
  if (!_clients.has(apiKey)) {
    _clients.set(apiKey, new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://sitenexis.com',
        'X-Title': 'SiteNexis AI Intelligence Platform',
      },
    }));
  }
  return _clients.get(apiKey)!;
}

// ─── Rate limiter — conservative 10 RPM per model for free tier ──────────────

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

// ─── Text completion ──────────────────────────────────────────────────────────

export interface OpenRouterOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  reasoning?: 'high' | 'xhigh';
}

export async function callOpenRouter<T>(
  model: OpenRouterModel,
  systemPrompt: string,
  userPrompt: string,
  opts: OpenRouterOptions = {},
): Promise<T> {
  const apiKey = getKeyForModel(model);
  if (!apiKey) throw new Error(`No API key configured for model ${model}`);

  await rateLimiter.acquire(model);

  const client = getClient(apiKey);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // DeepSeek reasoning mode — passed via model suffix or extra body
  const modelId = opts.reasoning
    ? `${model}` // OpenRouter accepts reasoning via extra_body for DeepSeek
    : model;

  const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
    model: modelId,
    messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  };

  const response = await client.chat.completions.create(body);
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter returned empty content for model ${model}`);

  // Parse JSON if jsonMode or if content looks like JSON
  if (opts.jsonMode || content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
    const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  }

  return content as unknown as T;
}

// ─── Vision completion (multimodal — Gemma 4 or Kimi K2.6) ───────────────────

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

  const client = getClient(apiKey);

  const imageContent = imageBase64OrUrl.startsWith('http')
    ? { type: 'image_url' as const, image_url: { url: imageBase64OrUrl } }
    : { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${imageBase64OrUrl}` } };

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          imageContent,
          { type: 'text', text: textPrompt },
        ],
      },
    ],
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter vision returned empty content for model ${model}`);

  if (opts.jsonMode || content.trimStart().startsWith('{')) {
    const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  }

  return content as unknown as T;
}
