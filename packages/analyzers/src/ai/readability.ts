import { z } from 'zod';
import { type CrawledPage, type AIReadabilityScore, type AIPageScore } from '@sitenexis/shared';
import { callAI } from './client';
import { buildCacheKey, getCachedScore, setCachedScore } from './cache';
import {
  entityClarityPrompt,
  conversationalReadinessPrompt,
  aiExtractabilityPrompt,
} from './prompts';

const BATCH_SIZE = 5;
const MAX_BODY_CHARS = 8_000; // ~2000 tokens

// ─── Response schemas ─────────────────────────────────────────────────────────

const EntityClaritySchema = z.object({
  score: z.number().int().min(0).max(25),
  missingEntities: z.array(z.string()).max(5),
});

const ConversationalReadinessSchema = z.object({
  score: z.number().int().min(0).max(25),
  issues: z.array(z.string()).max(5),
});

const AIExtractabilitySchema = z.object({
  score: z.number().int().min(0).max(25),
  summary: z.string(),
  issues: z.array(z.string()).max(5),
});

type EntityClarityResult = z.infer<typeof EntityClaritySchema>;
type ConversationalReadinessResult = z.infer<typeof ConversationalReadinessSchema>;
type AIExtractabilityResult = z.infer<typeof AIExtractabilitySchema>;

// ─── Extended per-page result (superset of AIPageScore) ──────────────────────

export interface AIPageReadabilityResult extends AIPageScore {
  missingEntities: string[];
  recommendations: string[];
}

// ─── Dimension 4: Knowledge Graph Structure (programmatic) ───────────────────

function computeKnowledgeGraphStructure(page: CrawledPage): number {
  let score = 0;

  // Schema markup present — structured data that defines the page topic (+10)
  if (page.schemaMarkup.length > 0) score += 10;

  // Internal links to related topics: +5 per meaningful cluster link, max 10
  // We proxy "cluster link" as distinct internal links (not just counting raw count)
  const uniqueInternalLinks = new Set(page.internalLinks).size;
  if (uniqueInternalLinks >= 4) score += 10;
  else if (uniqueInternalLinks >= 2) score += 5;

  // External links to authoritative sources (+5)
  const uniqueExternalLinks = new Set(page.externalLinks).size;
  if (uniqueExternalLinks >= 1) score += 5;

  return Math.min(score, 25);
}

// ─── Per-page scorer ──────────────────────────────────────────────────────────

async function scoreOnePage(page: CrawledPage): Promise<AIPageReadabilityResult> {
  const truncatedBody = page.bodyText.slice(0, MAX_BODY_CHARS);
  const cacheKey = buildCacheKey(page.url, truncatedBody);
  const cached = await getCachedScore<AIPageReadabilityResult>(cacheKey);
  if (cached) return cached;

  try {
    const title = page.title ?? '(no title)';
    const headingTexts = page.headings.map((h) => h.text);

    const [entityRaw, conversationalRaw, extractabilityRaw] = await Promise.all([
      callAI<unknown>(entityClarityPrompt(title, truncatedBody)),
      callAI<unknown>(conversationalReadinessPrompt(title, headingTexts, truncatedBody)),
      callAI<unknown>(aiExtractabilityPrompt(title, truncatedBody)),
    ]);

    const entityResult: EntityClarityResult = EntityClaritySchema.parse(entityRaw);
    const conversationalResult: ConversationalReadinessResult = ConversationalReadinessSchema.parse(conversationalRaw);
    const extractabilityResult: AIExtractabilityResult = AIExtractabilitySchema.parse(extractabilityRaw);

    const knowledgeGraph = computeKnowledgeGraphStructure(page);

    const total =
      entityResult.score +
      conversationalResult.score +
      extractabilityResult.score +
      knowledgeGraph;

    const recommendations = deriveRecommendations(
      entityResult,
      conversationalResult,
      extractabilityResult,
      knowledgeGraph
    );

    const result: AIPageReadabilityResult = {
      url: page.url,
      status: 'scored',
      entityClarity: entityResult.score,
      conversationalReadiness: conversationalResult.score,
      aiExtractability: extractabilityResult.score,
      knowledgeGraphStructure: knowledgeGraph,
      total,
      missingEntities: entityResult.missingEntities,
      recommendations,
    };

    await setCachedScore(cacheKey, result);
    return result;
  } catch {
    return {
      url: page.url,
      status: 'failed',
      entityClarity: null,
      conversationalReadiness: null,
      aiExtractability: null,
      knowledgeGraphStructure: null,
      total: null,
      missingEntities: [],
      recommendations: [],
    };
  }
}

// ─── Recommendation derivation ────────────────────────────────────────────────

function deriveRecommendations(
  entity: EntityClarityResult,
  conversational: ConversationalReadinessResult,
  extractability: AIExtractabilityResult,
  knowledgeGraphScore: number
): string[] {
  const recs: string[] = [];

  if (entity.score < 15) {
    recs.push('Define your primary entity (organisation, product, or person) clearly in the first paragraph.');
  }
  if (entity.missingEntities.length > 0) {
    recs.push(`Add missing entity context: ${entity.missingEntities.slice(0, 3).join('; ')}.`);
  }
  if (conversational.score < 15) {
    recs.push('Restructure content to directly answer the top 3–5 questions users would ask about this topic.');
  }
  if (conversational.issues.some((i) => i.toLowerCase().includes('faq'))) {
    recs.push('Add an FAQ section with natural language questions and direct answers.');
  }
  if (extractability.score < 15) {
    recs.push('Ensure each section has a clear topic sentence and a logical intro → body → conclusion structure.');
  }
  if (knowledgeGraphScore < 10) {
    recs.push('Add schema markup (Organisation, Article, or FAQPage) to make the page topic machine-readable.');
  }
  if (knowledgeGraphScore < 15) {
    recs.push('Add internal links to at least 2–4 topically related pages to strengthen the entity cluster.');
  }

  return recs.slice(0, 5);
}

// ─── Aggregate scorer ─────────────────────────────────────────────────────────

/**
 * Score all pages for AI readability across 4 dimensions.
 *
 * Processes pages in batches of 5 (per CLAUDE.md §29 — max 5 concurrent API calls).
 * Falls back gracefully if the API is unavailable — failed pages are excluded
 * from the average rather than zeroing the score.
 *
 * @param pages - Full crawl result. All pages are scored; no PageRank filter here
 *                (that filtering is applied by the AI Retrieval Agent for cost control).
 */
export async function analyzeAIReadability(
  pages: CrawledPage[]
): Promise<AIReadabilityScore> {
  const pageScores: AIPageReadabilityResult[] = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(scoreOnePage));
    pageScores.push(...results);
  }

  const scoredPages = pageScores.filter(
    (p): p is AIPageReadabilityResult & { total: number } => p.total !== null
  );

  const avgDimension = (key: keyof Pick<AIPageScore, 'entityClarity' | 'conversationalReadiness' | 'aiExtractability' | 'knowledgeGraphStructure'>) => {
    const vals = scoredPages
      .map((p) => p[key] as number | null)
      .filter((v): v is number => v !== null);
    return vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0;
  };

  // overall score: average of per-page totals (each total is already 0–100)
  const overallScore =
    scoredPages.length > 0
      ? Math.round(
          scoredPages.reduce((sum, p) => sum + p.total, 0) / scoredPages.length
        )
      : 0;

  // Aggregate missing entities across all scored pages (deduplicated, top 10)
  const allMissingEntities = [
    ...new Set(scoredPages.flatMap((p) => p.missingEntities)),
  ].slice(0, 10);

  // Aggregate recommendations (deduplicated, top 5 most common)
  const recCounts = new Map<string, number>();
  for (const p of scoredPages) {
    for (const rec of p.recommendations) {
      recCounts.set(rec, (recCounts.get(rec) ?? 0) + 1);
    }
  }
  const topRecommendations = [...recCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rec]) => rec);

  return {
    score: Math.min(100, Math.max(0, overallScore)),
    pageScores,
    breakdown: {
      entityClarity: avgDimension('entityClarity'),
      conversationalReadiness: avgDimension('conversationalReadiness'),
      aiExtractability: avgDimension('aiExtractability'),
      knowledgeGraphStructure: avgDimension('knowledgeGraphStructure'),
    },
    missingEntities: allMissingEntities,
    recommendations: topRecommendations,
  };
}
