import type { RegenerationResult, AdAnalyzerOptions } from './types.js';
import { SYSTEM_REGENERATOR, buildRegeneratorPrompt } from './prompts.js';

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: AdAnalyzerOptions,
): Promise<string> {
  if (opts.anthropicApiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': opts.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
        return data.content[0]?.text ?? '{}';
      }
    } catch { /* fall through to groq */ }
  }
  if (opts.groqApiKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.groqApiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content ?? '{}';
  }
  throw new Error('No AI provider configured');
}

export async function regenerateAd(
  params: {
    sourceAd: string;
    platforms: string[];
    tone: string;
    localization?: string;
    count: number;
  },
  opts: AdAnalyzerOptions,
): Promise<RegenerationResult> {
  const text = await callAI(SYSTEM_REGENERATOR, buildRegeneratorPrompt(params), opts);
  return parseJson<RegenerationResult>(text);
}
