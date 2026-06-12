import type { CrawledPage, TrustIssue } from '@sitenexis/shared';
import { routeTask } from '../ai/model-router';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeepContradictionResult {
  score: number;
  contradictionsDetected: number;
  issues: TrustIssue[];
  pagesAnalyzed: number;
  analysisSource: 'deepseek' | 'skipped';
}

interface DeepSeekContradictionResponse {
  contradictions: Array<{
    type: string;
    entity: string;
    pageA: string;
    pageB: string;
    claimA: string;
    claimB: string;
    severity: 'critical' | 'warning' | 'info';
    explanation: string;
  }>;
  overallCoherence: number;
}

// ─── DeepSeek whole-site semantic contradiction detection ─────────────────────

const SYSTEM = `You are a semantic contradiction detection engine for AI trust analysis.
You analyse web content across multiple pages to find factual contradictions, inconsistent entity claims,
and conflicting information that would reduce AI system confidence in this source.
Return ONLY valid JSON. No explanation. No markdown.`;

function buildContradictionPrompt(pages: CrawledPage[]): string {
  const pageSummaries = pages.map((p) => {
    // Extract key factual signals: dates, numbers, entity names, schema data
    const schemaFacts = (p.schemaMarkup as Record<string, unknown>[])
      .filter((s) => s && typeof s === 'object')
      .map((s) => {
        const obj = s as Record<string, unknown>;
        const relevant = ['name', 'description', 'foundingDate', 'datePublished', 'dateModified',
          'addressLocality', 'addressCountry', 'telephone', 'email', 'priceRange'];
        return relevant
          .filter((k) => obj[k])
          .map((k) => `${k}:${String(obj[k])}`)
          .join(', ');
      })
      .filter(Boolean)
      .join(' | ');

    // First 500 chars of body — where key claims usually appear
    const bodyExcerpt = p.bodyText.slice(0, 500).replace(/\s+/g, ' ').trim();

    return `PAGE: ${p.url}
TITLE: ${p.title ?? 'untitled'}
SCHEMA: ${schemaFacts || 'none'}
CONTENT_EXCERPT: ${bodyExcerpt}`;
  }).join('\n\n---\n\n');

  return `Analyse the following ${pages.length} pages from the same website for semantic contradictions.

Look for:
1. Entity attribute conflicts (same entity described differently across pages)
2. Date/timeline inconsistencies (founding year, event dates, product release dates)
3. Factual claim contradictions (statistics, prices, contact details, locations that differ)
4. Schema markup that contradicts visible page content
5. Authorship or organisational claim conflicts

${pageSummaries}

Return ONLY valid JSON:
{
  "contradictions": [
    {
      "type": "entity_attribute|date_conflict|factual_claim|schema_body_mismatch|authorship_conflict",
      "entity": "the entity or claim involved",
      "pageA": "url of first page",
      "pageB": "url of conflicting page",
      "claimA": "what page A states",
      "claimB": "what page B states (conflicting)",
      "severity": "critical|warning|info",
      "explanation": "why this is a contradiction and how it affects AI trust"
    }
  ],
  "overallCoherence": 85
}`;
}

/**
 * Run DeepSeek V4 Flash semantic contradiction detection across all pages.
 * Uses 1M token context — no page limit.
 * Falls back gracefully if DeepSeek is not configured.
 */
export async function detectContradictionsWithDeepSeek(
  pages: CrawledPage[],
): Promise<DeepContradictionResult> {
  if (pages.length === 0) {
    return { score: 100, contradictionsDetected: 0, issues: [], pagesAnalyzed: 0, analysisSource: 'skipped' };
  }

  try {
    const prompt = buildContradictionPrompt(pages);
    const result = await routeTask<DeepSeekContradictionResponse>(
      'contradiction_detection',
      SYSTEM,
      prompt,
      { jsonMode: true, maxTokens: 4096, reasoning: 'high' },
    );

    if (!result) {
      return { score: 100, contradictionsDetected: 0, issues: [], pagesAnalyzed: pages.length, analysisSource: 'skipped' };
    }

    const issues: TrustIssue[] = (result.contradictions ?? []).map((c) => ({
      type: c.type as TrustIssue['type'],
      severity: c.severity,
      entity: c.entity,
      description: `Contradiction between ${c.pageA} and ${c.pageB}: ${c.claimA} vs ${c.claimB}`,
      recommendation: `Resolve the conflict: ${c.explanation}`,
    }));

    const contradictionsDetected = issues.length;
    const baseScore = Math.min(100, Math.max(0, result.overallCoherence ?? 100));
    // Apply additional deductions for critical contradictions
    const criticalDeduction = issues.filter((i) => i.severity === 'critical').length * 15;
    const warningDeduction = issues.filter((i) => i.severity === 'warning').length * 5;
    const score = Math.max(0, baseScore - criticalDeduction - warningDeduction);

    return {
      score,
      contradictionsDetected,
      issues,
      pagesAnalyzed: pages.length,
      analysisSource: 'deepseek',
    };
  } catch (err) {
    console.error('[deep-contradiction] DeepSeek analysis failed (non-fatal):', err instanceof Error ? err.message : String(err));
    return { score: 100, contradictionsDetected: 0, issues: [], pagesAnalyzed: pages.length, analysisSource: 'skipped' };
  }
}
