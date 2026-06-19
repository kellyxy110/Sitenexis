import type {
  ScoutIntentType,
  ScoutPageIntent,
  ScoutIntentDistribution,
  ScoutAnalysisResult,
  ScoutPipelineStage,
  GTLState,
} from '@sitenexis/shared';
import { routeTask } from '../ai/model-router';
import { INTENT_CLASSIFICATION_SYSTEM, buildIntentUserPrompt } from './prompts';
import { computeIntentAlignment } from './alignment';

const ALL_INTENTS: ScoutIntentType[] = [
  'informational', 'commercial', 'navigational', 'research',
  'creation', 'learn_and_solve', 'local',
];

export interface ScoutEngineInput {
  domain: string;
  pages: Array<{
    url: string;
    title: string;
    headings: string[];
    bodyText: string;
    wordCount: number;
    hasSchema: boolean;
    schemaTypes: string[];
  }>;
}

interface IntentClassificationResponse {
  primaryIntent: string;
  primaryConfidence: number;
  secondaryIntents: Array<{ intent: string; confidence: number }>;
  intentSignals: string[];
}

export async function runScoutAnalysis(input: ScoutEngineInput): Promise<ScoutAnalysisResult> {
  const { domain, pages } = input;
  const timestamp = new Date().toISOString();

  if (pages.length === 0) {
    return emptyResult(domain, timestamp, 'No pages available for analysis');
  }

  // ── Stage 1: Ingestion ────────────────────────────────────────────────────
  const ingestion: ScoutPipelineStage = {
    status: 'complete',
    detail: `${pages.length} pages ingested from existing audit`,
  };

  // ── Stage 2: Embedding (deferred to v1.1) ─────────────────────────────────
  const embedding: ScoutPipelineStage = {
    status: 'skipped',
    detail: 'BGE-M3 embedding integration deferred to v1.1 — intent classification uses text features',
  };

  // ── Stage 3: Reasoning — Intent Classification ────────────────────────────
  const sample = pages.slice(0, 50);
  const pageIntents: ScoutPageIntent[] = [];
  let classifiedCount = 0;
  let modelUsed = 'qwen/qwen3-next-80b-a3b-instruct:free';

  const concurrency = 3;
  for (let i = 0; i < sample.length; i += concurrency) {
    const batch = sample.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((page) => classifyPageIntent(page))
    );

    for (let j = 0; j < results.length; j++) {
      const page = batch[j]!;
      const result = results[j]!;

      if (result.status === 'fulfilled' && result.value) {
        pageIntents.push(result.value);
        classifiedCount++;
      } else {
        pageIntents.push(fallbackClassification(page.url, page.title, page.bodyText));
        classifiedCount++;
      }
    }
  }

  const reasoning: ScoutPipelineStage = {
    status: classifiedCount === sample.length ? 'complete' : 'partial',
    detail: `${classifiedCount}/${sample.length} pages classified via ${modelUsed}`,
  };

  // ── Aggregation ──────────────────────────────────────────────────────────
  const intentDistribution = computeIntentDistribution(pageIntents);
  const dominantIntent = intentDistribution.length > 0
    ? intentDistribution[0]!.intent
    : 'informational';

  const intentCoverageScore = computeIntentCoverage(intentDistribution);
  const intentAlignmentScore = computeIntentAlignment(pageIntents, input.pages);
  const recommendations = generateRecommendations(
    intentDistribution, intentCoverageScore, intentAlignmentScore, pageIntents
  );

  // ── Stage 4: Memory Writeback ─────────────────────────────────────────────
  const memoryWriteback: ScoutPipelineStage = {
    status: 'complete',
    detail: `${pageIntents.length} intent classifications ready for DB writeback`,
  };

  const hasPartialFailure = classifiedCount < sample.length;
  const state: GTLState = pageIntents.length === 0
    ? 'empty'
    : hasPartialFailure ? 'partial' : 'complete';

  return {
    state,
    timestamp,
    ...(hasPartialFailure ? { reason: `${sample.length - classifiedCount} pages failed classification` } : {}),
    domain,
    pagesAnalyzed: pageIntents.length,
    pageIntents,
    intentDistribution,
    dominantIntent,
    intentCoverageScore,
    intentAlignmentScore,
    recommendations,
    pipeline: { ingestion, embedding, reasoning, memoryWriteback },
  };
}

async function classifyPageIntent(page: {
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
}): Promise<ScoutPageIntent | null> {
  const contentExcerpt = page.bodyText.slice(0, 1500);
  const userPrompt = buildIntentUserPrompt(
    page.url, page.title, page.headings.slice(0, 10), contentExcerpt
  );

  const response = await routeTask<IntentClassificationResponse>(
    'scout_intent_classification',
    INTENT_CLASSIFICATION_SYSTEM,
    userPrompt,
    { jsonMode: true, maxTokens: 512, temperature: 0.1 },
  );

  if (!response) return null;

  const primaryIntent = validateIntent(response.primaryIntent);
  const primaryConfidence = clamp(response.primaryConfidence ?? 0.5, 0, 1);
  const secondaryIntents = (response.secondaryIntents ?? [])
    .map((s) => ({ intent: validateIntent(s.intent), confidence: clamp(s.confidence, 0, 1) }))
    .filter((s) => s.intent !== primaryIntent)
    .slice(0, 3);
  const intentSignals = (response.intentSignals ?? []).slice(0, 5);

  return {
    url: page.url,
    title: page.title,
    primaryIntent,
    primaryConfidence,
    secondaryIntents,
    intentSignals,
  };
}

function fallbackClassification(url: string, title: string, bodyText: string): ScoutPageIntent {
  const combined = `${url} ${title} ${bodyText}`.toLowerCase();
  let intent: ScoutIntentType = 'informational';

  if (/pric|buy|shop|product|cart|checkout|plan|subscription/.test(combined)) {
    intent = 'commercial';
  } else if (/about|contact|login|sign.?in|team|career/.test(combined)) {
    intent = 'navigational';
  } else if (/how.?to|step|tutorial|guide|fix|solve|troubleshoot/.test(combined)) {
    intent = 'learn_and_solve';
  } else if (/research|study|data|analysis|report|whitepaper|survey/.test(combined)) {
    intent = 'research';
  } else if (/generat|calculat|tool|builder|creator|template/.test(combined)) {
    intent = 'creation';
  } else if (/near.?me|location|address|store|branch|local/.test(combined)) {
    intent = 'local';
  }

  return {
    url, title,
    primaryIntent: intent,
    primaryConfidence: 0.4,
    secondaryIntents: [],
    intentSignals: ['Classified via keyword fallback — AI model unavailable'],
  };
}

function validateIntent(raw: string): ScoutIntentType {
  const normalized = raw.toLowerCase().replace(/[^a-z_]/g, '');
  if (ALL_INTENTS.includes(normalized as ScoutIntentType)) {
    return normalized as ScoutIntentType;
  }
  return 'informational';
}

function computeIntentDistribution(intents: ScoutPageIntent[]): ScoutIntentDistribution[] {
  if (intents.length === 0) return [];

  const counts = new Map<ScoutIntentType, { count: number; totalConfidence: number }>();
  for (const intent of ALL_INTENTS) {
    counts.set(intent, { count: 0, totalConfidence: 0 });
  }

  for (const page of intents) {
    const entry = counts.get(page.primaryIntent)!;
    entry.count++;
    entry.totalConfidence += page.primaryConfidence;
  }

  const distribution: ScoutIntentDistribution[] = [];
  for (const [intent, { count, totalConfidence }] of counts.entries()) {
    if (count === 0) continue;
    distribution.push({
      intent,
      pageCount: count,
      percentage: Math.round((count / intents.length) * 1000) / 10,
      averageConfidence: Math.round((totalConfidence / count) * 100) / 100,
    });
  }

  return distribution.sort((a, b) => b.pageCount - a.pageCount);
}

function computeIntentCoverage(distribution: ScoutIntentDistribution[]): number {
  if (distribution.length === 0) return 0;

  const coveredIntents = distribution.filter((d) => d.pageCount > 0).length;
  const maxIntents = ALL_INTENTS.length;
  const diversityRatio = coveredIntents / maxIntents;

  const hasCommercial = distribution.some((d) => d.intent === 'commercial' && d.pageCount > 0);
  const hasInformational = distribution.some((d) => d.intent === 'informational' && d.pageCount > 0);
  const hasNavigational = distribution.some((d) => d.intent === 'navigational' && d.pageCount > 0);

  let bonus = 0;
  if (hasCommercial && hasInformational) bonus += 10;
  if (hasNavigational) bonus += 5;

  const evenness = computeEvenness(distribution);

  return clamp(Math.round(diversityRatio * 50 + evenness * 35 + bonus), 0, 100);
}

function computeEvenness(distribution: ScoutIntentDistribution[]): number {
  if (distribution.length <= 1) return 0;
  const total = distribution.reduce((s, d) => s + d.pageCount, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const d of distribution) {
    if (d.pageCount === 0) continue;
    const p = d.pageCount / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(distribution.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

function generateRecommendations(
  distribution: ScoutIntentDistribution[],
  coverageScore: number,
  alignmentScore: number,
  pageIntents: ScoutPageIntent[],
): string[] {
  const recs: string[] = [];

  const missingIntents = ALL_INTENTS.filter(
    (intent) => !distribution.some((d) => d.intent === intent && d.pageCount > 0)
  );

  if (missingIntents.includes('commercial')) {
    recs.push('No commercial intent pages detected. Consider adding product/service pages with pricing and CTAs to capture transactional queries.');
  }
  if (missingIntents.includes('learn_and_solve')) {
    recs.push('No how-to or problem-solving content detected. Adding tutorial/guide pages increases retrieval surface for procedural queries.');
  }
  if (missingIntents.includes('research')) {
    recs.push('No research-oriented content found. Data-driven pages with original analysis strengthen citation probability.');
  }

  if (coverageScore < 40) {
    recs.push(`Intent coverage score is ${coverageScore}/100. The site concentrates on too few intent types, limiting AI retrieval surface.`);
  }

  if (alignmentScore < 50) {
    recs.push(`Intent alignment score is ${alignmentScore}/100. Many pages lack structural signals matching their classified intent (schema, headings, CTAs).`);
  }

  const lowConfidencePages = pageIntents.filter((p) => p.primaryConfidence < 0.5);
  if (lowConfidencePages.length > pageIntents.length * 0.3) {
    recs.push(`${lowConfidencePages.length} pages have ambiguous intent signals (confidence < 50%). Clarify each page's purpose through stronger headings and focused content.`);
  }

  if (recs.length === 0) {
    recs.push('Intent distribution is well-balanced. Continue strengthening structural alignment signals (schema, headings, FAQ markup) for each intent type.');
  }

  return recs.slice(0, 5);
}

function emptyResult(domain: string, timestamp: string, reason: string): ScoutAnalysisResult {
  return {
    state: 'empty',
    timestamp,
    reason,
    domain,
    pagesAnalyzed: 0,
    pageIntents: [],
    intentDistribution: [],
    dominantIntent: 'informational',
    intentCoverageScore: 0,
    intentAlignmentScore: 0,
    recommendations: [],
    pipeline: {
      ingestion: { status: 'skipped', detail: reason },
      embedding: { status: 'skipped', detail: 'No pages to embed' },
      reasoning: { status: 'skipped', detail: 'No pages to classify' },
      memoryWriteback: { status: 'skipped', detail: 'No results to write' },
    },
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
