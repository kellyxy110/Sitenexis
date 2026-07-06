// Bynara Router — OpenAI-compatible inference provider.
// Base URL: https://router.bynara.id/v1
// Auth: Bearer token via BYNARA_API_KEY env var.
// Modular: add BYNARA_BASE_URL to override the default endpoint.

import { parseAIResponse } from './prompts';

const BYNARA_DEFAULT_URL = 'https://router.bynara.id/v1';

export const BYNARA_MODELS = {
  MISTRAL_LARGE: 'mistral-large',
  MISTRAL_MEDIUM: 'mistral-medium',
  MISTRAL_SMALL:  'mistral-small',
} as const;

export type BynaraModel = (typeof BYNARA_MODELS)[keyof typeof BYNARA_MODELS];

function getBynaraKey(): string {
  return process.env['BYNARA_API_KEY'] ?? '';
}

function getBynaraBaseUrl(): string {
  return (process.env['BYNARA_BASE_URL'] ?? BYNARA_DEFAULT_URL).replace(/\/$/, '');
}

export function isBynaraConfigured(): boolean {
  return getBynaraKey().length > 10;
}

export interface BynaraOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

// ─── Completion ───────────────────────────────────────────────────────────────

export async function callBynara<T>(
  model: BynaraModel,
  systemPrompt: string,
  userPrompt: string,
  opts: BynaraOptions = {},
): Promise<T> {
  const apiKey = getBynaraKey();
  if (!apiKey) throw new Error('BYNARA_API_KEY is not configured');

  const baseUrl = getBynaraBaseUrl();
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.1,
    max_tokens:  opts.maxTokens  ?? 2_048,
  };

  if (opts.jsonMode) {
    body['response_format'] = { type: 'json_object' };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://sitenexis.com',
      'X-Title':       'SiteNexis',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Bynara ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (json.error) throw new Error(`Bynara error: ${json.error.message ?? 'unknown'}`);

  const content = json.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Bynara returned empty content');

  if (opts.jsonMode || content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
    return parseAIResponse<T>(content);
  }

  return content as unknown as T;
}
