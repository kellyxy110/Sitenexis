import type {
  CrawledPage,
  Entity,
  EntityIssue,
  EntityIntelligenceReport,
} from '@sitenexis/shared';
import { callAI } from '../ai/client';
import { callGroq, isGroqConfigured } from '../ai/groq-client';
import {
  groqEntityExtractionPrompt,
  claudeEntityDisambiguationPrompt,
  entityDetectionPrompt,
} from '../ai/prompts';
import { buildCacheKey, getCachedScore, setCachedScore } from '../ai/cache';

// ─── Internal types ───────────────────────────────────────────────────────────

interface GroqEntityCandidate {
  name: string;
  type: string;
  mentionCount: number;
}

/**
 * Raw output from the Groq fast extraction stage.
 * Treated as candidates only — not scored, not trusted as final.
 */
interface GroqExtractionResult {
  entities: GroqEntityCandidate[];
  summary: string;
  keywords: string[];
  contentTags: string[];
}

interface ValidatedEntity {
  name: string;
  type: string;
  description: string | null;
  sameAsHints: string[];
  mentionCount: number;
}

/**
 * Final extraction result produced by the hybrid pipeline.
 *
 * source indicates how the result was obtained:
 *   'hybrid'      — Groq candidates validated by Claude (normal path)
 *   'claude-only' — Groq unavailable or errored; Claude ran independently
 *   'empty'       — Groq ran successfully but found zero entities, or
 *                   Claude validation produced zero entities after Groq
 *                   found candidates. entityConfidenceScore MUST be 0 in
 *                   both empty sub-cases.
 */
interface EntityExtractionResult {
  entities: ValidatedEntity[];
  primaryEntity: string | null;
  missingAttributes: string[];
  source: 'hybrid' | 'claude-only' | 'empty';
}

// ─── Entity normalisation ─────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Stage 1: Groq fast entity candidate extraction ───────────────────────────

/**
 * Calls Groq to extract a raw list of entity candidates.
 *
 * Returns null on any API error (not the same as returning an empty entity
 * list). Callers treat null as "Groq unavailable" and fall back to Claude-only.
 */
async function extractCandidatesWithGroq(
  page: CrawledPage,
): Promise<GroqExtractionResult | null> {
  try {
    return await callGroq<GroqExtractionResult>(
      groqEntityExtractionPrompt(page.title ?? page.url, page.bodyText),
    );
  } catch {
    return null;
  }
}

// ─── Stage 2: AI entity disambiguation and validation ────────────────────────

/**
 * Takes Groq 8b candidates and asks the 70b model to:
 * - validate each candidate (drop false positives)
 * - enrich with description + sameAs hints
 * - identify the primary entity
 * - detect missing attributes
 *
 * entityConfidenceScore is derived ONLY from the entities returned here.
 */
async function disambiguateWithAI(
  page: CrawledPage,
  groqResult: GroqExtractionResult,
): Promise<EntityExtractionResult | null> {
  try {
    const raw = await callAI<{
      entities: ValidatedEntity[];
      primaryEntity: string | null;
      missingAttributes: string[];
    }>(claudeEntityDisambiguationPrompt(page.title ?? page.url, page.bodyText, groqResult));

    return { ...raw, source: 'hybrid' };
  } catch {
    return null;
  }
}

// ─── AI-only fallback ─────────────────────────────────────────────────────────

/**
 * Fallback path: Stage 1 (8b) not configured or errored.
 * 70b model performs cold entity extraction from raw page text.
 */
async function extractWithAI(page: CrawledPage): Promise<EntityExtractionResult> {
  try {
    const raw = await callAI<{
      entities: ValidatedEntity[];
      primaryEntity: string | null;
      missingAttributes: string[];
    }>(entityDetectionPrompt(page.title ?? page.url, page.bodyText));

    return { ...raw, source: 'claude-only' };
  } catch {
    return { entities: [], primaryEntity: null, missingAttributes: [], source: 'empty' };
  }
}

// ─── Hybrid extraction pipeline ───────────────────────────────────────────────

/**
 * Per-page hybrid extraction.
 *
 * Decision tree:
 *   Groq not configured                → Claude-only (legacy behavior)
 *   Groq errored (API failure)         → Claude-only (fallback)
 *   Groq returned 0 entities           → empty (entityConfidenceScore = 0, skip Claude)
 *   Groq returned entities             → Claude disambiguation
 *   Claude returned 0 after candidates → empty (entityConfidenceScore = 0)
 *   Claude returned entities           → hybrid result (score from Claude output only)
 */
async function extractEntitiesFromPage(page: CrawledPage): Promise<EntityExtractionResult> {
  const cacheKey = buildCacheKey(page.url, page.bodyText.slice(0, 1_000));
  const cached = await getCachedScore<EntityExtractionResult>(`entity:${cacheKey}`);
  if (cached) return cached;

  let result: EntityExtractionResult;

  if (!isGroqConfigured()) {
    result = await extractWithAI(page);
  } else {
    const groqResult = await extractCandidatesWithGroq(page);

    if (groqResult === null) {
      // Stage 1 (8b) error — fall back to 70b cold extraction so a transient
      // outage doesn't zero-out the entire entity report.
      result = await extractWithAI(page);
    } else if (groqResult.entities.length === 0) {
      // Groq ran successfully and found nothing — this page genuinely has no
      // named entities. Do not call Claude and do not assign phantom confidence.
      result = { entities: [], primaryEntity: null, missingAttributes: [], source: 'empty' };
    } else {
      // Groq found candidates — Claude validates and enriches them.
      const claudeResult = await disambiguateWithAI(page, groqResult);

      if (!claudeResult || claudeResult.entities.length === 0) {
        // Claude validation eliminated all candidates or Claude itself failed.
        // No validated entities → entityConfidenceScore must be 0.
        result = { entities: [], primaryEntity: null, missingAttributes: [], source: 'empty' };
      } else {
        result = claudeResult;
      }
    }
  }

  await setCachedScore(`entity:${cacheKey}`, result);
  return result;
}

// ─── Consistency scoring ──────────────────────────────────────────────────────

interface EntityMentions {
  descriptions: string[];
  types: string[];
  sameAsUrls: string[];
  mentionCount: number;
  pages: string[];
}

function scoreEntityConsistency(
  entityMap: Map<string, EntityMentions>,
): { score: number; issues: EntityIssue[] } {
  const issues: EntityIssue[] = [];
  let totalConsistency = 0;
  let entityCount = 0;

  for (const [name, mentions] of entityMap) {
    entityCount++;
    let entityScore = 100;

    const uniqueTypes = new Set(mentions.types);
    if (uniqueTypes.size > 1) {
      entityScore -= 20;
      issues.push({
        entityName: name,
        issueType: 'inconsistency',
        severity: 'warning',
        description: `Entity type inconsistency: described as "${[...uniqueTypes].join('", "')}" on different pages.`,
        recommendation: `Standardise the entity type for "${name}" across all pages. Use consistent schema markup.`,
      });
    }

    if (mentions.descriptions.length > 1) {
      const firstDesc = mentions.descriptions[0] ?? '';
      const allSimilar = mentions.descriptions.every((desc) => {
        const words1 = new Set(firstDesc.toLowerCase().split(/\s+/));
        const words2 = new Set(desc.toLowerCase().split(/\s+/));
        const intersection = [...words1].filter((w) => words2.has(w)).length;
        const union = new Set([...words1, ...words2]).size;
        return union === 0 || intersection / union > 0.3;
      });

      if (!allSimilar) {
        entityScore -= 15;
        issues.push({
          entityName: name,
          issueType: 'inconsistency',
          severity: 'warning',
          description: `Entity "${name}" is described differently across pages.`,
          recommendation: `Create a canonical description for "${name}" and use it consistently. Schema markup with the same description field helps.`,
        });
      }
    }

    totalConsistency += entityScore;
  }

  return {
    score: entityCount > 0 ? Math.round(totalConsistency / entityCount) : 100,
    issues,
  };
}

// ─── Coverage scoring ─────────────────────────────────────────────────────────

function scoreEntityCoverage(
  entityMap: Map<string, EntityMentions>,
  totalPages: number,
): { score: number; issues: EntityIssue[] } {
  const issues: EntityIssue[] = [];

  if (entityMap.size === 0) {
    return {
      score: 10,
      issues: [{
        entityName: '(site)',
        issueType: 'missing_attribute',
        severity: 'critical',
        description: 'No named entities detected across any crawled page.',
        recommendation: 'Add explicit named entities (company name, products, authors, locations) with clear definitions. Entities are the atomic units of AI knowledge.',
      }],
    };
  }

  const pagesWithEntities = [...entityMap.values()].reduce(
    (count, m) => count + m.pages.length,
    0,
  );
  const entityDensity = Math.min(
    100,
    Math.round((pagesWithEntities / Math.max(totalPages, 1)) * 25),
  );

  let coverageScore = Math.min(100, entityMap.size * 5 + entityDensity);

  const lowCoverageEntities = [...entityMap.entries()].filter(
    ([, m]) => m.pages.length === 1 && entityMap.size > 3,
  );
  if (lowCoverageEntities.length > entityMap.size * 0.5) {
    coverageScore -= 20;
    issues.push({
      entityName: '(multiple)',
      issueType: 'missing_attribute',
      severity: 'warning',
      description: `${lowCoverageEntities.length} entities appear on only one page each.`,
      recommendation: 'Key entities should be referenced across multiple pages to build topical authority. Create interconnected content clusters around primary entities.',
    });
  }

  return { score: Math.min(100, Math.max(0, coverageScore)), issues };
}

// ─── Disambiguation scoring ───────────────────────────────────────────────────

function scoreEntityDisambiguation(
  entityMap: Map<string, EntityMentions>,
): { score: number; issues: EntityIssue[] } {
  const issues: EntityIssue[] = [];
  let score = 100;

  const withSameAs = [...entityMap.values()].filter((m) => m.sameAsUrls.length > 0).length;
  const sameAsRatio = entityMap.size > 0 ? withSameAs / entityMap.size : 0;

  if (sameAsRatio < 0.2 && entityMap.size >= 3) {
    score -= 30;
    issues.push({
      entityName: '(site)',
      issueType: 'disambiguation_failure',
      severity: 'critical',
      description: 'Very few entities have sameAs links to external knowledge sources.',
      recommendation: 'Add schema markup with sameAs links to Wikipedia, Wikidata, LinkedIn, or other authoritative sources for your primary entities. This is the single highest-value disambiguation signal for AI systems.',
    });
  } else if (sameAsRatio < 0.4 && entityMap.size >= 3) {
    score -= 15;
    issues.push({
      entityName: '(site)',
      issueType: 'disambiguation_failure',
      severity: 'warning',
      description: 'Less than 40% of entities have sameAs external references.',
      recommendation: 'Add sameAs links in schema markup to unambiguously identify key entities against external knowledge graphs.',
    });
  }

  const genericNames = [...entityMap.keys()].filter(
    (name) => name.split(' ').length === 1 && name.length < 6,
  );
  if (genericNames.length > 0) {
    score -= 10;
    issues.push({
      entityName: genericNames[0] ?? '(entity)',
      issueType: 'disambiguation_failure',
      severity: 'warning',
      description: `Short generic entity names detected: "${genericNames.join('", "')}". These may be ambiguous to AI systems.`,
      recommendation: 'Use full entity names and provide contextual descriptions. Short acronyms or single words require schema markup to disambiguate.',
    });
  }

  return { score: Math.max(0, score), issues };
}

// ─── Intelligence Module: Platform presence + fragmentation risk ─────────────

import type { PlatformPresence } from '@sitenexis/shared';

const PLATFORM_PATTERNS: Record<keyof PlatformPresence, RegExp> = {
  wikipedia:  /wikipedia\.org/i,
  wikidata:   /wikidata\.org/i,
  linkedin:   /linkedin\.com/i,
  github:     /github\.com/i,
  youtube:    /youtube\.com|youtu\.be/i,
  crunchbase: /crunchbase\.com/i,
};

function detectPlatformPresence(allSameAsUrls: string[]): PlatformPresence {
  const result = {} as PlatformPresence;
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS) as [keyof PlatformPresence, RegExp][]) {
    result[platform] = allSameAsUrls.some((url) => pattern.test(url));
  }
  return result;
}

function assessFragmentationRisk(
  entityConsistencyScore: number,
  disambiguationScore: number,
  platformPresence: PlatformPresence,
): { fragmentationRisk: boolean; fragmentationRiskReason?: string } {
  const hasCriticalPresence = platformPresence.wikipedia || platformPresence.wikidata || platformPresence.linkedin;

  if (entityConsistencyScore < 40) {
    return {
      fragmentationRisk: true,
      fragmentationRiskReason: `Entity consistency score (${entityConsistencyScore}) is critically low — AI systems will see conflicting identity signals across pages.`,
    };
  }
  if (disambiguationScore < 40 && !hasCriticalPresence) {
    return {
      fragmentationRisk: true,
      fragmentationRiskReason: `Disambiguation score (${disambiguationScore}) is low and no authoritative external presence (Wikipedia, Wikidata, LinkedIn) is linked. AI systems cannot reliably identify this entity.`,
    };
  }
  if (entityConsistencyScore < 60 && disambiguationScore < 50) {
    return {
      fragmentationRisk: true,
      fragmentationRiskReason: `Both consistency (${entityConsistencyScore}) and disambiguation (${disambiguationScore}) are below threshold. AI identity fragmentation risk is elevated.`,
    };
  }
  return { fragmentationRisk: false };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeEntityIntelligence(
  pages: CrawledPage[],
): Promise<EntityIntelligenceReport> {
  if (pages.length === 0) {
    return {
      entitiesDetected: [],
      primaryEntity: null,
      entityConsistencyScore: 0,
      entityCoverageScore: 0,
      disambiguationScore: 0,
      entityConfidenceScore: 0,
      inconsistencies: [],
      missingAttributes: [],
      recommendations: [],
    };
  }

  const sample = pages.slice(0, 20);

  const entityMap = new Map<string, EntityMentions>();
  let primaryEntityName: string | null = null;
  const allMissingAttributes: string[] = [];
  // Track whether any page returned validated entities from the hybrid pipeline.
  // entityConfidenceScore is 0 if every page came back 'empty'.
  let hasAnyValidatedEntities = false;

  const batchSize = 5;
  for (let i = 0; i < sample.length; i += batchSize) {
    const batch = sample.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(extractEntitiesFromPage));

    for (let j = 0; j < batch.length; j++) {
      const page = batch[j]!;
      const result = results[j]!;

      if (result.source !== 'empty' && result.entities.length > 0) {
        hasAnyValidatedEntities = true;
      }

      if (!primaryEntityName && result.primaryEntity) {
        primaryEntityName = result.primaryEntity;
      }

      for (const raw of result.entities) {
        const key = normalizeName(raw.name);
        const existing = entityMap.get(key);
        if (existing) {
          if (raw.description) existing.descriptions.push(raw.description);
          existing.types.push(raw.type);
          existing.sameAsUrls.push(...raw.sameAsHints);
          existing.mentionCount += raw.mentionCount;
          existing.pages.push(page.url);
        } else {
          entityMap.set(key, {
            descriptions: raw.description ? [raw.description] : [],
            types: [raw.type],
            sameAsUrls: [...raw.sameAsHints],
            mentionCount: raw.mentionCount,
            pages: [page.url],
          });
        }
      }

      allMissingAttributes.push(...result.missingAttributes);
    }
  }

  // Build Entity[] from aggregated map
  const entitiesDetected: Entity[] = [...entityMap.entries()].map(([normalizedName, mentions]) => ({
    id: normalizedName,
    name: normalizedName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    normalizedName,
    type: mentions.types[0] ?? 'Unknown',
    description: mentions.descriptions[0] ?? null,
    sameAsUrls: [...new Set(mentions.sameAsUrls)],
    mentionCount: mentions.mentionCount,
    consistencyScore: 0,
    disambiguationScore: 0,
  }));

  // Zero-confidence guard:
  // - no entities were detected, OR
  // - every page returned source:'empty' (Groq found nothing and/or Claude
  //   validated nothing) — prevents phantom confidence from empty inputs.
  if (entitiesDetected.length === 0 || !hasAnyValidatedEntities) {
    return {
      entitiesDetected: [],
      primaryEntity: null,
      entityConsistencyScore: 0,
      entityCoverageScore: 0,
      disambiguationScore: 0,
      entityConfidenceScore: 0,
      inconsistencies: [],
      missingAttributes: [...new Set(allMissingAttributes)].slice(0, 10),
      recommendations: [
        'No validated entities detected. Verify that content contains clear named entities and that the Groq API key is configured.',
      ],
      platformPresence: detectPlatformPresence([]),
      fragmentationRisk: true,
      fragmentationRiskReason: 'No validated entities detected — AI systems cannot identify this domain as a coherent entity.',
    };
  }

  // All sub-scores computed from Claude-validated entities only.
  const { score: consistencyScore, issues: consistencyIssues } = scoreEntityConsistency(entityMap);
  const { score: coverageScore, issues: coverageIssues } = scoreEntityCoverage(entityMap, pages.length);
  const { score: disambiguationScore, issues: disambiguationIssues } = scoreEntityDisambiguation(entityMap);

  for (const entity of entitiesDetected) {
    entity.consistencyScore = consistencyScore;
    entity.disambiguationScore = disambiguationScore;
  }

  const primaryEntityObj = primaryEntityName
    ? (entitiesDetected.find(
        (e) => e.normalizedName === normalizeName(primaryEntityName!),
      ) ?? null)
    : (entitiesDetected[0] ?? null);

  // entityConfidenceScore is derived from validated final entities only.
  const entityConfidenceScore = Math.round(
    consistencyScore * 0.30
    + coverageScore   * 0.35
    + disambiguationScore * 0.35,
  );

  const allIssues: EntityIssue[] = [
    ...consistencyIssues,
    ...coverageIssues,
    ...disambiguationIssues,
  ];

  const uniqueMissingAttributes = [...new Set(allMissingAttributes)].slice(0, 10);

  const recommendations: string[] = [];
  if (disambiguationScore < 70) {
    recommendations.push('Add schema markup with sameAs links to external knowledge sources for all primary entities.');
  }
  if (coverageScore < 60) {
    recommendations.push('Build topical content clusters around primary entities — each entity should be referenced across multiple related pages.');
  }
  if (consistencyScore < 70) {
    recommendations.push('Standardise entity names, types, and descriptions across all pages. Inconsistency degrades AI confidence in entity identity.');
  }
  if (entitiesDetected.length < 3) {
    recommendations.push('Enrich content with explicit named entities. Entity-sparse pages are invisible to AI knowledge extraction pipelines.');
  }

  // Intelligence module extensions
  const allSameAsUrls = entitiesDetected.flatMap((e) => e.sameAsUrls);
  const platformPresence = detectPlatformPresence(allSameAsUrls);
  const { fragmentationRisk, fragmentationRiskReason } = assessFragmentationRisk(
    consistencyScore, disambiguationScore, platformPresence,
  );

  return {
    entitiesDetected,
    primaryEntity: primaryEntityObj,
    entityConsistencyScore: consistencyScore,
    entityCoverageScore: coverageScore,
    disambiguationScore,
    entityConfidenceScore,
    inconsistencies: allIssues.filter(
      (i): i is EntityIssue & { issueType: 'inconsistency' } => i.issueType === 'inconsistency',
    ),
    missingAttributes: uniqueMissingAttributes,
    recommendations,
    platformPresence,
    fragmentationRisk,
    ...(fragmentationRiskReason !== undefined ? { fragmentationRiskReason } : {}),
  };
}
