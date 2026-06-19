import type {
  InformationGainResult,
  IGECohortPage,
  IGEQuestion,
  IGEEntity,
  IGEEvidenceBlock,
} from '@sitenexis/shared';
import { collectSerpCohort } from './cohort-collector';
import {
  extractEntities,
  extractQuestions,
  extractEvidenceBlocks,
  htmlToText,
  extractHeadings,
} from './extractor';
import { detectSharedKnowledge } from './shared-knowledge-detector';
import { detectQuestionGaps } from './question-gap-detector';
import { detectEntityGaps } from './entity-gap-detector';
import { detectEvidenceGap } from './evidence-detector';
import { computeIGEScore, computePCEConfidence } from './scorer';
import { estimateRetrievalValue } from './retrieval-value-estimator';

export interface IGEEngineInput {
  keyword: string;
  targetUrl: string;
  /** Optional — if not provided, the engine fetches it */
  targetHtml?: string;
}

/**
 * Main IGE orchestrator. Runs all 10 phases and returns a GTL-wrapped InformationGainResult.
 *
 * ZFDA: All gap detection is based exclusively on content crawled from real pages.
 * No invented gaps. If SERP collection fails entirely → state: 'empty'.
 * If partial crawl (some pages failed) → state: 'partial' with reduced confidence.
 */
export async function runIGEEngine(input: IGEEngineInput): Promise<InformationGainResult> {
  const { keyword, targetUrl } = input;
  const timestamp = new Date().toISOString();

  // ── Phase 1: Collect SERP cohort ─────────────────────────────────────────────
  const { pages: rawPages, error: serpError } = await collectSerpCohort(keyword, 10);

  if (serpError && rawPages.length === 0) {
    return emptyResult(keyword, targetUrl, timestamp, serpError);
  }

  // ── Phase 2: Fetch target page if HTML not provided ───────────────────────────
  let targetHtml = input.targetHtml ?? '';
  if (!targetHtml) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SiteNexis-IGE/1.0; +https://sitenexis.com/bot)',
        },
        signal: AbortSignal.timeout(8_000),
        redirect: 'follow',
      });
      if (res.ok) {
        targetHtml = await res.text();
      }
    } catch {
      // Target fetch failed — continue with empty HTML; the engine will still
      // produce useful cohort analysis but target comparison will be limited
    }
  }

  // ── Phase 3: Extract content from each cohort page ────────────────────────────
  const cohortPages: IGECohortPage[] = rawPages.map((raw) => {
    if (!raw.crawlSuccess || !raw.html) {
      return {
        url: raw.url,
        title: raw.title,
        wordCount: raw.wordCount,
        headings: [],
        entities: [],
        questions: [],
        evidenceBlocks: [],
        crawlSuccess: false,
        crawledAt: timestamp,
      };
    }
    const text = htmlToText(raw.html);
    return {
      url: raw.url,
      title: raw.title,
      wordCount: raw.wordCount,
      headings: extractHeadings(raw.html),
      entities: extractEntities(text),
      questions: extractQuestions(raw.html, text),
      evidenceBlocks: extractEvidenceBlocks(text),
      crawlSuccess: true,
      crawledAt: timestamp,
    };
  });

  // Build target IGECohortPage
  const targetText = htmlToText(targetHtml);
  const targetPage: IGECohortPage = {
    url: targetUrl,
    title: extractTitleFromHtml(targetHtml),
    wordCount: targetText.split(/\s+/).filter((w) => w.length > 0).length,
    headings: extractHeadings(targetHtml),
    entities: extractEntities(targetText),
    questions: extractQuestions(targetHtml, targetText),
    evidenceBlocks: extractEvidenceBlocks(targetText),
    crawlSuccess: Boolean(targetHtml),
    crawledAt: timestamp,
  };

  // Determine overall state
  const successfulPages = cohortPages.filter((p) => p.crawlSuccess);
  const hasPartialFailure = successfulPages.length < cohortPages.length;
  const state: InformationGainResult['state'] =
    successfulPages.length === 0
      ? 'empty'
      : hasPartialFailure
      ? 'partial'
      : 'complete';

  if (successfulPages.length === 0) {
    return emptyResult(keyword, targetUrl, timestamp, 'All cohort pages failed to crawl');
  }

  // ── Phase 4: Detect shared knowledge ─────────────────────────────────────────
  const allPages = [...cohortPages, targetPage];
  const sharedKnowledge = detectSharedKnowledge(allPages);

  // ── Phase 5: Detect question gaps ────────────────────────────────────────────
  const questionGap = detectQuestionGaps(cohortPages, targetPage);

  // ── Phase 6: Detect entity gaps ──────────────────────────────────────────────
  const entityGap = detectEntityGaps(cohortPages, targetPage);

  // ── Phase 7: Detect evidence gaps ────────────────────────────────────────────
  const evidenceGap = detectEvidenceGap(cohortPages, targetPage);

  // ── Phase 8: Compute IGE score + PCE confidence ───────────────────────────────
  const { score: informationGainScore, breakdown: scoreBreakdown } = computeIGEScore(
    targetPage,
    cohortPages,
    questionGap,
    entityGap,
    evidenceGap
  );

  const confidence = computePCEConfidence(cohortPages);

  // ── Phase 9: Estimate retrieval value ─────────────────────────────────────────
  const retrievalValue = estimateRetrievalValue(informationGainScore, evidenceGap);

  // ── Phase 10: Build citation opportunities list (ZFDA) ────────────────────────
  // Only from actual crawled gaps — no invented opportunities
  const citationOpportunities: string[] = [];

  // Unclaimed questions the target already covers = citation candidate
  const unclaimedCoveredByTarget = questionGap.rareQuestions
    .filter((q) => q.tier === 'unclaimed' && q.coveredByTarget)
    .slice(0, 5);
  for (const q of unclaimedCoveredByTarget) {
    citationOpportunities.push(`Unique answer to unclaimed question: "${q.question}"`);
  }

  // Critical unclaimed questions not yet covered = opportunity
  const criticalUnclaimed = [
    ...questionGap.rareQuestions.filter((q) => q.tier === 'unclaimed' && !q.coveredByTarget),
    ...questionGap.unansweredQuestions,
  ].slice(0, 5);
  for (const q of criticalUnclaimed) {
    citationOpportunities.push(`High-opportunity unclaimed question to address: "${q.question}"`);
  }

  // Unique entities as citation opportunities
  for (const entity of entityGap.targetUniqueEntities.slice(0, 3)) {
    citationOpportunities.push(`Unique entity coverage not found in cohort: "${entity}"`);
  }

  // ── Separate fact vs perception layers ────────────────────────────────────────

  // Fact layer: raw extracted data from ALL crawled pages (cohort + target)
  const allExtractedQuestions: IGEQuestion[] = [];
  const allExtractedEntities: IGEEntity[] = [];
  const allExtractedEvidence: IGEEvidenceBlock[] = [];
  const sourcedFromUrls: string[] = [];

  for (const page of [...cohortPages, targetPage]) {
    if (!page.crawlSuccess) continue;
    sourcedFromUrls.push(page.url);
    allExtractedQuestions.push(...page.questions);
    allExtractedEntities.push(...page.entities);
    allExtractedEvidence.push(...page.evidenceBlocks);
  }

  // Perception layer: inferred themes + opportunities (simple keyword grouping, not AI)
  const inferredThemes = buildThemeClusters(sharedKnowledge.sharedTopics, 4);
  const inferredOpportunities = buildOpportunitySummaries(
    questionGap,
    entityGap,
    evidenceGap
  ).slice(0, 3);
  const perceptionConfidence = confidence;

  // cohortQualityScore: 0-100 based on how well the cohort was collected
  const cohortQualityScore = Math.round(
    Math.min(100, (successfulPages.length / Math.max(1, cohortPages.length)) * 100)
  );

  return {
    state,
    timestamp,
    ...(hasPartialFailure ? { reason: `${cohortPages.length - successfulPages.length} cohort pages failed to crawl` } : {}),

    keyword,
    targetUrl,
    cohortSize: cohortPages.length,
    cohortPagesSuccessful: successfulPages.length,
    cohortQualityScore,

    informationGainScore,
    confidence,
    scoreBreakdown,

    sharedKnowledge,
    questionGap,
    entityGap,
    evidenceGap,
    retrievalValue,
    citationOpportunities,

    factLayer: {
      extractedQuestions: deduplicateQuestions(allExtractedQuestions).slice(0, 100),
      extractedEntities: deduplicateEntities(allExtractedEntities).slice(0, 100),
      extractedEvidence: allExtractedEvidence.slice(0, 100),
      sourcedFromUrls,
    },

    perceptionLayer: {
      inferredThemes,
      inferredOpportunities,
      perceptionConfidence,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyResult(
  keyword: string,
  targetUrl: string,
  timestamp: string,
  reason: string
): InformationGainResult {
  return {
    state: 'empty',
    timestamp,
    reason,
    keyword,
    targetUrl,
    cohortSize: 0,
    cohortPagesSuccessful: 0,
    cohortQualityScore: 0,
    informationGainScore: 0,
    confidence: 0,
    scoreBreakdown: {
      uniqueEntityScore: 0,
      uniqueQuestionScore: 0,
      uniqueEvidenceScore: 0,
      novelChunkScore: 0,
      coverageScore: 0,
    },
    sharedKnowledge: { sharedCoveragePercent: 0, sharedTopics: [] },
    questionGap: {
      totalQuestionsExtracted: 0,
      coveredQuestions: [],
      rareQuestions: [],
      unansweredQuestions: [],
    },
    entityGap: {
      universalEntities: [],
      commonEntities: [],
      rareEntities: [],
      targetUniqueEntities: [],
      missingFromTarget: [],
    },
    evidenceGap: {
      cohortAverageBlocks: 0,
      targetBlocks: 0,
      evidenceGap: 0,
      cohortTypeCounts: {},
      targetTypeCounts: {},
      missingTypes: [],
    },
    retrievalValue: 'low',
    citationOpportunities: [],
    factLayer: {
      extractedQuestions: [],
      extractedEntities: [],
      extractedEvidence: [],
      sourcedFromUrls: [],
    },
    perceptionLayer: {
      inferredThemes: [],
      inferredOpportunities: [],
      perceptionConfidence: 0,
    },
  };
}

/**
 * Group shared topics into up to maxClusters theme clusters by keyword similarity.
 * Simple approach: use the top-coverage topics as cluster seeds.
 */
function buildThemeClusters(
  sharedTopics: Array<{ topic: string; coverageCount: number; coveragePercent: number }>,
  maxClusters: number
): string[] {
  if (sharedTopics.length === 0) return [];

  // Take top topics by coverage, deduplicate into broad theme labels
  const themes: string[] = [];
  const usedWords = new Set<string>();

  for (const { topic } of sharedTopics) {
    if (themes.length >= maxClusters) break;
    if (usedWords.has(topic)) continue;
    usedWords.add(topic);
    // Capitalize first letter for display
    themes.push(topic.charAt(0).toUpperCase() + topic.slice(1));
  }

  return themes;
}

function buildOpportunitySummaries(
  questionGap: InformationGainResult['questionGap'],
  entityGap: InformationGainResult['entityGap'],
  evidenceGap: InformationGainResult['evidenceGap']
): string[] {
  const opportunities: string[] = [];

  const topUnclaimed = questionGap.unansweredQuestions.slice(0, 1);
  for (const q of topUnclaimed) {
    opportunities.push(
      `No competitor addresses the question: "${q.question}" — covering this creates a citation opportunity.`
    );
  }

  if (entityGap.missingFromTarget.length > 0) {
    const top = entityGap.missingFromTarget.slice(0, 2).join(', ');
    opportunities.push(
      `Key entities covered by most competitors but missing from this page: ${top}. Adding these improves topical alignment.`
    );
  }

  if (evidenceGap.missingTypes.length > 0) {
    const types = evidenceGap.missingTypes.slice(0, 2).join(', ');
    opportunities.push(
      `Evidence types present in competitors but absent from this page: ${types}. Adding these increases retrieval weight.`
    );
  }

  if (entityGap.targetUniqueEntities.length > 0) {
    opportunities.push(
      `This page covers ${entityGap.targetUniqueEntities.length} entities not found in any competitor — a strong unique signal for AI citation.`
    );
  }

  return opportunities;
}

function extractTitleFromHtml(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? (match[1]?.trim() ?? '') : '';
}

function deduplicateQuestions(questions: IGEQuestion[]): IGEQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.text.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateEntities(entities: IGEEntity[]): IGEEntity[] {
  const seen = new Map<string, IGEEntity>();
  for (const e of entities) {
    const key = e.name.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing || e.mentionCount > existing.mentionCount) {
      seen.set(key, e);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.mentionCount - a.mentionCount);
}
