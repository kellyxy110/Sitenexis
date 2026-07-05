import type { IssueContext, GeneratedFix, FixLanguage } from './types.js';
import { makeGroqAdapter } from '@sitenexis/adapters';
import { parseAIResponse } from '../ai/prompts.js';

const SYSTEM_PROMPT = `You are a senior web developer and AI visibility expert.
Given a website issue, produce a concise fix that is ready to paste into code.

Respond ONLY with valid JSON matching this structure:
{
  "problem": "1-2 sentences: what specifically is wrong and why it matters for AI retrieval",
  "solution": "1-2 sentences: conceptual description of what needs to change",
  "fixCode": "ready-to-paste code or markup — not pseudocode",
  "fixLanguage": "json-ld | html | typescript | text",
  "expectedImpact": "high | medium | low",
  "effort": "low | medium | high"
}

Rules:
- fixCode must be actual usable code, not placeholder explanation
- For schema fixes, output valid JSON-LD
- For HTML fixes, output valid HTML fragments
- For Next.js fixes, output valid TypeScript
- problem/solution must be specific to this exact issue, not generic
- Return ONLY valid JSON. No explanation. No markdown.`;

function buildPrompt(ctx: IssueContext): string {
  return `Issue type: ${ctx.type}
Severity: ${ctx.severity}
Module: ${ctx.module}
Page URL: ${ctx.pageUrl ?? 'unknown'}
Domain: ${ctx.domain ?? 'unknown'}
Issue message: ${ctx.message}
Current recommendation: ${ctx.recommendation}

Generate a Problem → Solution → Fix for this specific issue.`;
}

function isValidFixLanguage(lang: unknown): lang is FixLanguage {
  return lang === 'json-ld' || lang === 'html' || lang === 'typescript' || lang === 'text';
}

type FixResponse = {
  problem: string;
  solution: string;
  fixCode: string;
  fixLanguage: string;
  expectedImpact: string;
  effort: string;
};

export async function generateFixWithGroq(
  ctx: IssueContext,
  apiKey: string,
): Promise<GeneratedFix> {
  const output = await makeGroqAdapter(apiKey).complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildPrompt(ctx),
    model: 'llama-3.1-8b-instant',
    maxTokens: 800,
    temperature: 0.2,
    jsonMode: true,
  });

  const parsed = parseAIResponse<FixResponse>(output.content);

  return {
    problem: String(parsed.problem ?? ''),
    solution: String(parsed.solution ?? ''),
    fixCode: String(parsed.fixCode ?? ''),
    fixLanguage: isValidFixLanguage(parsed.fixLanguage) ? parsed.fixLanguage : 'text',
    expectedImpact: (['high', 'medium', 'low'] as const).includes(parsed.expectedImpact as 'high')
      ? (parsed.expectedImpact as 'high' | 'medium' | 'low')
      : 'medium',
    effort: (['low', 'medium', 'high'] as const).includes(parsed.effort as 'low')
      ? (parsed.effort as 'low' | 'medium' | 'high')
      : 'medium',
    source: 'llm',
  };
}
