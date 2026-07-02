export const dynamic = 'force-dynamic';
export const maxDuration = 45;

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

export type ContentBrief = {
  auditId: string;
  domain: string;
  topic: string;
  targetQuery: string;
  recommendedTitle: string;
  questionHeadings: string[];
  faqSuggestions: { question: string; shortAnswer: string }[];
  schemaToAdd: string[];
  targetWordCount: number;
  dataPointsToSource: string[];
  missingSignals: string[];
  generatedAt: string;
};

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Not available in this mode' }, { status: 503 });
  }

  try {
    const { getAuditWithResults, getIssuesByAudit } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as {
      userId: string; domain: string; status: string;
      scores?: { aiScore?: number; seoScore?: number; schemaScore?: number } | null;
    } | null;

    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (audit.status !== 'complete') return NextResponse.json({ error: 'Audit not complete yet' }, { status: 409 });

    const rawIssues = await getIssuesByAudit(id);

    // Bucket issues into signals to fix
    const criticalIssues = rawIssues.filter((i) => i.severity === 'critical').map((i) => i.message ?? i.type);
    const warningIssues = rawIssues.filter((i) => i.severity === 'warning').map((i) => i.message ?? i.type);
    const missingSignals = [...criticalIssues.slice(0, 5), ...warningIssues.slice(0, 5)];

    // Derive schema gaps
    const schemaIssues = rawIssues.filter((i) => i.module === 'schema' || i.type?.includes('schema') || i.type?.includes('structured'));
    const schemaToAdd: string[] = [];
    if (schemaIssues.some((i) => i.type?.includes('faq') || i.message?.toLowerCase().includes('faq'))) schemaToAdd.push('FAQPage');
    if (schemaIssues.some((i) => i.type?.includes('article') || i.message?.toLowerCase().includes('article'))) schemaToAdd.push('Article');
    if (schemaIssues.some((i) => i.message?.toLowerCase().includes('howto') || i.type?.includes('howto'))) schemaToAdd.push('HowTo');
    if (schemaIssues.some((i) => i.message?.toLowerCase().includes('organization') || i.type?.includes('org'))) schemaToAdd.push('Organization');
    if (schemaToAdd.length === 0) schemaToAdd.push('FAQPage', 'Article');

    // Build prompt context
    const promptContext = [
      `Domain: ${audit.domain}`,
      `AI Score: ${audit.scores?.aiScore ?? 'N/A'}/100`,
      `SEO Score: ${audit.scores?.seoScore ?? 'N/A'}/100`,
      `Schema Score: ${audit.scores?.schemaScore ?? 'N/A'}/100`,
      `Critical issues: ${criticalIssues.slice(0, 6).join('; ') || 'none'}`,
      `Warnings: ${warningIssues.slice(0, 6).join('; ') || 'none'}`,
      `Missing schema: ${schemaToAdd.join(', ')}`,
    ].join('\n');

    // Try model router (Hermes) for structured brief generation
    const { routeTask } = await import('@sitenexis/analyzers');

    const systemPrompt = `You are an AI citation optimization strategist.
Given an audit summary for a domain, generate a structured content brief in JSON.
The brief should help the domain owner create one piece of content that directly addresses the gaps.
Return ONLY valid JSON. No explanation. No markdown.`;

    const userPrompt = `Audit summary:
${promptContext}

Generate a content brief with this exact JSON structure:
{
  "topic": "brief topic statement (max 12 words)",
  "targetQuery": "the primary question this content should answer (conversational form)",
  "recommendedTitle": "SEO-optimised title (50-60 chars)",
  "questionHeadings": ["5-7 H2/H3 headings phrased as questions"],
  "faqSuggestions": [
    {"question": "Q1", "shortAnswer": "Direct answer under 40 words"},
    {"question": "Q2", "shortAnswer": "..."},
    {"question": "Q3", "shortAnswer": "..."}
  ],
  "targetWordCount": 900,
  "dataPointsToSource": ["3-5 specific facts/stats to find and cite in the content"]
}`;

    type BriefShape = {
      topic: string; targetQuery: string; recommendedTitle: string;
      questionHeadings: string[]; faqSuggestions: { question: string; shortAnswer: string }[];
      targetWordCount: number; dataPointsToSource: string[];
    };

    let generated: BriefShape | null = null;
    try {
      generated = await routeTask<BriefShape>('structured_scoring', systemPrompt, userPrompt, { jsonMode: true, maxTokens: 1200 });
    } catch (err) {
      logger.warn({ err, auditId: id }, 'Content brief AI generation failed — using fallback');
    }

    // Fallback if AI generation fails
    const brief: ContentBrief = {
      auditId: id,
      domain: audit.domain,
      topic:              generated?.topic              ?? `Improving AI citation signals for ${audit.domain}`,
      targetQuery:        generated?.targetQuery        ?? `How does ${audit.domain} help with [primary use case]?`,
      recommendedTitle:   generated?.recommendedTitle   ?? `Complete Guide to ${audit.domain} — Features, Use Cases & FAQ`,
      questionHeadings:   generated?.questionHeadings   ?? [
        `What is ${audit.domain} and who is it for?`,
        `How does ${audit.domain} work?`,
        `What are the main features of ${audit.domain}?`,
        `How does ${audit.domain} compare to alternatives?`,
        `What results can I expect from ${audit.domain}?`,
        `Is ${audit.domain} the right solution for my use case?`,
      ],
      faqSuggestions:     generated?.faqSuggestions     ?? [
        { question: `What is ${audit.domain}?`, shortAnswer: `${audit.domain} is a [describe service]. It helps [target audience] to [primary value proposition].` },
        { question: `How do I get started with ${audit.domain}?`, shortAnswer: `Getting started takes [time]. You need [requirements]. The first step is [action].` },
        { question: `Is ${audit.domain} free?`, shortAnswer: `${audit.domain} offers [pricing model]. [Tier description and what's included].` },
      ],
      schemaToAdd,
      targetWordCount:    generated?.targetWordCount    ?? 1200,
      dataPointsToSource: generated?.dataPointsToSource ?? [
        'Industry statistic relevant to primary topic',
        'Comparison metric vs. category average',
        'Specific outcome or result data point',
      ],
      missingSignals,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(brief);
  } catch (err) {
    logger.error({ err, auditId: id }, 'Content brief generation failed');
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 });
  }
}
