// Fast Groq path — llama-3.1-8b-instant for high-throughput extraction tasks.
// No provider SDK imported here — delegates to @sitenexis/adapters GroqAdapter.

import { getGroqFastAdapter } from '@sitenexis/adapters';
import { parseAIResponse } from './prompts';
import { emitAiCall } from './telemetry';

export const GROQ_MODEL = 'llama-3.1-8b-instant';

const GROQ_MAX_TOKENS = 1_024;
const GROQ_TEMPERATURE = 0.1;

const GROQ_SYSTEM_PROMPT =
  'You are a fast structured extraction engine. ' +
  'Identify and classify named entities exactly as instructed. ' +
  'Return ONLY valid JSON. No explanation. No markdown. No commentary.';

export interface CallGroqOptions {
  /** Overrides the default entity-extraction system prompt for other fast-path callers (e.g. Scout intent classification). */
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** Hard per-call deadline. Bounded so a slow/unavailable Groq call can never stall a caller's batch. */
  timeoutMs?: number;
}

/**
 * Returns true only when GROQ_API_KEY is present and non-placeholder.
 */
export function isGroqConfigured(): boolean {
  const key = process.env['GROQ_API_KEY'] ?? '';
  return key.length > 0 && !key.includes('placeholder');
}

/**
 * Call Groq with llama-3.1-8b-instant and parse the JSON response.
 * Used for Stage 1 entity extraction and Scout intent classification —
 * fast, cheap, high-throughput, single-provider (no multi-model chain).
 *
 * @throws Error if the API returns empty content, non-JSON, or times out —
 *         callers that need graceful degradation must catch this themselves.
 */
export async function callGroq<T>(userPrompt: string, options: CallGroqOptions = {}): Promise<T> {
  const start = Date.now();
  try {
    const output = await getGroqFastAdapter().complete({
      systemPrompt: options.systemPrompt ?? GROQ_SYSTEM_PROMPT,
      userPrompt,
      model: GROQ_MODEL,
      maxTokens: options.maxTokens ?? GROQ_MAX_TOKENS,
      temperature: options.temperature ?? GROQ_TEMPERATURE,
      ...(options.timeoutMs !== undefined ? { ctx: { timeoutMs: options.timeoutMs } } : {}),
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
      model: GROQ_MODEL,
      latencyMs: Date.now() - start,
      success: false,
      errorCode: err instanceof Error ? redactSecrets(err.message).slice(0, 64) : 'unknown',
    });
    throw err;
  }
}

/**
 * Some SDK error messages echo back the offending Authorization header value
 * (e.g. "Incorrect API key provided: gsk_***"). Strip anything shaped like a
 * Groq key before it ever reaches a log line or telemetry event.
 */
function redactSecrets(message: string): string {
  return message.replace(/gsk_[A-Za-z0-9]{8,}/g, '[redacted]');
}
