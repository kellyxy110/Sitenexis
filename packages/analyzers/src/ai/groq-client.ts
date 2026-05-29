import OpenAI from 'openai';
import { parseAIResponse } from './prompts';

// llama-3.1-8b-instant: low-latency, purpose-fit for structured extraction tasks.
// Not used for reasoning, scoring, or trust modeling — those stay with Claude.
export const GROQ_MODEL = 'llama-3.1-8b-instant';

const GROQ_MAX_TOKENS = 1_024;
const GROQ_TEMPERATURE = 0.1; // Near-deterministic — extraction not generation

const GROQ_SYSTEM_PROMPT =
  'You are a fast structured extraction engine. ' +
  'Identify and classify named entities exactly as instructed. ' +
  'Return ONLY valid JSON. No explanation. No markdown. No commentary.';

let _groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!_groqClient) {
    _groqClient = new OpenAI({
      apiKey: process.env['GROQ_API_KEY'] ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _groqClient;
}

/**
 * Returns true only when GROQ_API_KEY is present and non-placeholder.
 * Used to decide whether to attempt the Groq extraction stage.
 */
export function isGroqConfigured(): boolean {
  const key = process.env['GROQ_API_KEY'] ?? '';
  return key.length > 0 && !key.includes('placeholder');
}

/**
 * Call Groq with a user prompt and parse the JSON response.
 * Uses the OpenAI-compatible Groq endpoint — no new SDK required.
 *
 * @throws Error if the API returns empty content or the response is not valid JSON.
 */
export async function callGroq<T>(userPrompt: string): Promise<T> {
  const client = getGroqClient();

  const response = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: GROQ_MAX_TOKENS,
    temperature: GROQ_TEMPERATURE,
    messages: [
      { role: 'system', content: GROQ_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq API returned empty content for model ${GROQ_MODEL}`);
  }

  return parseAIResponse<T>(content);
}
