// Fast Groq path — llama-3.1-8b-instant for high-throughput extraction tasks.
// No provider SDK imported here — delegates to @sitenexis/adapters GroqAdapter.

import { getGroqFastAdapter } from '@sitenexis/adapters';
import { parseAIResponse } from './prompts';

export const GROQ_MODEL = 'llama-3.1-8b-instant';

const GROQ_MAX_TOKENS = 1_024;
const GROQ_TEMPERATURE = 0.1;

const GROQ_SYSTEM_PROMPT =
  'You are a fast structured extraction engine. ' +
  'Identify and classify named entities exactly as instructed. ' +
  'Return ONLY valid JSON. No explanation. No markdown. No commentary.';

/**
 * Returns true only when GROQ_API_KEY is present and non-placeholder.
 */
export function isGroqConfigured(): boolean {
  const key = process.env['GROQ_API_KEY'] ?? '';
  return key.length > 0 && !key.includes('placeholder');
}

/**
 * Call Groq with llama-3.1-8b-instant and parse the JSON response.
 * Used for Stage 1 entity extraction — fast, cheap, high-throughput.
 *
 * @throws Error if the API returns empty content or non-JSON.
 */
export async function callGroq<T>(userPrompt: string): Promise<T> {
  const output = await getGroqFastAdapter().complete({
    systemPrompt: GROQ_SYSTEM_PROMPT,
    userPrompt,
    model: GROQ_MODEL,
    maxTokens: GROQ_MAX_TOKENS,
    temperature: GROQ_TEMPERATURE,
  });
  return parseAIResponse<T>(output.content);
}
