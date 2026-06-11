import type { IssueContext, GeneratedFix } from './types.js';
import { getTemplateFixForIssue } from './templates.js';
import { generateFixWithGroq } from './groq.js';

export type { GeneratedFix, IssueContext };

export async function generateFix(
  ctx: IssueContext,
  options: { groqApiKey?: string } = {},
): Promise<GeneratedFix> {
  // Template fix takes priority — deterministic, instant, no cost
  const templateFix = getTemplateFixForIssue(ctx);
  if (templateFix) return templateFix;

  // Groq LLM fix for issue types without a template
  if (options.groqApiKey) {
    try {
      return await generateFixWithGroq(ctx, options.groqApiKey);
    } catch (err) {
      // Fall through to fallback
      console.warn('[fixes] Groq fix generation failed, using fallback:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback: structured text fix derived from the recommendation
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
