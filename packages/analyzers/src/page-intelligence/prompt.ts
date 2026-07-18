import type { Finding, PageFacts } from './finding-pool';

export const PAGE_INTELLIGENCE_SYSTEM_PROMPT = [
  'You are the SiteNexis Page Intelligence engine — an explanation and optimization layer, NOT a scoring engine.',
  '',
  'STRICT RULES:',
  '- SiteNexis\'s deterministic engines are the only source of truth for scores. NEVER calculate, estimate, restate as your own, or contradict any score.',
  '- Every recommendation you produce MUST include sourceFindingIds: an array of ids taken ONLY from the FINDINGS list provided below. If a recommendation cannot be tied to at least one finding id from that exact list, do not produce it.',
  '- Preserve factual accuracy in your rewrite. Never invent data, statistics, or claims not present in the original content.',
  '- Do not stuff keywords. Every recommendation must have a measurable SEO or AI-visibility rationale.',
  '- citabilityByEngine is a qualitative estimate (low/medium/high) with reasoning — never a fabricated precise score.',
  '- Optimize first for the human reader, then for search engines and AI systems.',
  '- Return ONLY valid JSON matching the requested schema. No markdown, no surrounding prose.',
].join('\n');

export interface PageIntelligenceContext {
  url: string;
  page: PageFacts;
  bodyText: string;
  findings: Finding[];
}

const MAX_BODY_CHARS = 8_000;

export function buildPageIntelligenceUserPrompt(ctx: PageIntelligenceContext): string {
  const findingsBlock = ctx.findings.map((f) => `- ${f.id}: ${f.label}`).join('\n');

  return [
    `PAGE: ${ctx.url}`,
    `Title: ${ctx.page.title ?? '(none)'}`,
    `Meta description: ${ctx.page.metaDescription ?? '(none)'}`,
    `H1: ${ctx.page.h1 ?? '(none)'}`,
    `Word count: ${ctx.page.wordCount}`,
    '',
    'FINDINGS (the ONLY ids you may cite in sourceFindingIds):',
    findingsBlock,
    '',
    'ORIGINAL BODY TEXT:',
    ctx.bodyText.slice(0, MAX_BODY_CHARS),
    '',
    'Return a single JSON object with this exact shape:',
    JSON.stringify(
      {
        diagnosis: 'string — why this page underperforms, referencing findings',
        recommendations: [
          { action: 'string', rationale: 'string', sourceFindingIds: ['finding-id-from-list-above'], expectedImpact: 'string' },
        ],
        optimizedTitle: 'string or null',
        optimizedMetaDescription: 'string or null',
        optimizedH1: 'string or null',
        optimizedBodyText: 'string — the full rewritten page body',
        citabilityByEngine: [
          { engine: 'ChatGPT | Gemini | Claude | Perplexity | Copilot | Grok | Google AI Overviews', likelihood: 'low | medium | high', reasoning: 'string' },
        ],
      },
      null,
      2,
    ),
  ].join('\n');
}
