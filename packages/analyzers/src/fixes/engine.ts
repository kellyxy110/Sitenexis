import type { IssueContext, GeneratedFix } from './types.js';
import { getTemplateFixForIssue } from './templates.js';
import { generateFixWithGroq } from './groq.js';
import { routeTask, isAnyOpenRouterAvailable } from '../ai/model-router.js';

export type { GeneratedFix, IssueContext };

const FIX_SYSTEM = `You are a senior web developer and AI visibility expert.
Given a website issue, produce a concise, production-ready fix.

Respond ONLY with valid JSON:
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
- For schema fixes, output valid JSON-LD with all required fields
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

type FixLanguage = 'json-ld' | 'html' | 'typescript' | 'text';

function isValidFixLanguage(lang: unknown): lang is FixLanguage {
  return lang === 'json-ld' || lang === 'html' || lang === 'typescript' || lang === 'text';
}

export async function generateFix(
  ctx: IssueContext,
  options: { groqApiKey?: string } = {},
): Promise<GeneratedFix> {
  // Template fix takes priority — deterministic, instant, no cost
  const templateFix = getTemplateFixForIssue(ctx);
  if (templateFix) return templateFix;

  // Kimi K2.6 — production-quality JSON-LD, HTML, and code generation
  // Specialised for structured data and code output quality
  if (isAnyOpenRouterAvailable()) {
    const taskType = ctx.module === 'schema' ? 'schema_generation' : 'code_generation';
    try {
      const result = await routeTask<Record<string, unknown>>(
        taskType,
        FIX_SYSTEM,
        buildPrompt(ctx),
        { jsonMode: true, maxTokens: 1200, temperature: 0.15 },
      );
      if (result) {
        return {
          problem: String(result.problem ?? ''),
          solution: String(result.solution ?? ''),
          fixCode: String(result.fixCode ?? ''),
          fixLanguage: isValidFixLanguage(result.fixLanguage) ? result.fixLanguage : 'text',
          expectedImpact: (['high', 'medium', 'low'] as const).includes(result.expectedImpact as 'high')
            ? result.expectedImpact as 'high' | 'medium' | 'low'
            : 'medium',
          effort: (['low', 'medium', 'high'] as const).includes(result.effort as 'low')
            ? result.effort as 'low' | 'medium' | 'high'
            : 'medium',
          source: 'llm',
        };
      }
    } catch (err) {
      console.warn('[fixes] Kimi fix generation failed, falling back to Groq:', err instanceof Error ? err.message : String(err));
    }
  }

  // Groq fallback — fast, always available
  if (options.groqApiKey) {
    try {
      return await generateFixWithGroq(ctx, options.groqApiKey);
    } catch (err) {
      console.warn('[fixes] Groq fix generation failed, using fallback:', err instanceof Error ? err.message : String(err));
    }
  }

  // Last resort: structured text fix derived from the recommendation
  return {
    problem: `${ctx.message} This affects AI retrieval by reducing the quality signals available for this ${ctx.module} dimension.`,
    solution: ctx.recommendation,
    fixCode: `# ${ctx.type.replace(/_/g, ' ').toUpperCase()}\n\n${ctx.recommendation}\n\nApply this fix to: ${ctx.pageUrl ?? 'all affected pages'}`,
    fixLanguage: 'text',
    expectedImpact: ctx.severity === 'critical' ? 'high' : ctx.severity === 'warning' ? 'medium' : 'low',
    effort: 'medium',
    source: 'template',
  };
}
