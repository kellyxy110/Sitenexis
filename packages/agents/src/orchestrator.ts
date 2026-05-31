/**
 * SiteNexis Agent Orchestrator
 *
 * Routing intelligence layer for the 5-agent SII pipeline.
 * Decides WHICH agents run, in WHAT ORDER, with WHAT parallelism.
 *
 * This module does NOT perform analysis. It produces an execution plan.
 *
 * Agent dependency graph:
 *   Site Audit Agent       ──────────────────────────────┐
 *   Entity Extraction Agent ──► AI Visibility Agent       ├──► SII Aggregator
 *                          ──► Retrieval Analysis Agent   │
 *                                                         │
 * Phase 1 (parallel): Site Audit + Entity Extraction
 * Phase 2 (parallel): AI Visibility + Retrieval Analysis
 * Phase 3 (sequential): SII Aggregator
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CrawlDataType = 'full_page' | 'partial' | 'multi_page';

export type UserIntent =
  | 'seo_audit'
  | 'ai_visibility'
  | 'entity_mapping'
  | 'retrieval_analysis'
  | 'full_intelligence'
  | null;

export type AgentName =
  | 'Site Audit Agent'
  | 'AI Visibility Agent'
  | 'Entity Extraction Agent'
  | 'Retrieval Analysis Agent'
  | 'SII Aggregator';

export interface StoredResult {
  cachedAt: string;   // ISO 8601
  ageHours: number;
  fresh: boolean;     // false = older than FRESHNESS_TTL_HOURS
}

export interface PageMetrics {
  wordCount?: number;
  metaTagCount?: number;
  schemaMarkupDensity?: number;  // 0.0–1.0
  isNew?: boolean;
  hasDynamicContent?: boolean;
  pageCount?: number;            // for multi_page crawls
}

export interface OrchestratorInput {
  url: string;
  crawlDataType: CrawlDataType;
  userIntent?: UserIntent | undefined;
  existingResults?: Partial<Record<
    'siteAudit' | 'aiVisibility' | 'entityExtraction' | 'retrievalAnalysis',
    StoredResult
  >> | undefined;
  pageMetrics?: PageMetrics | undefined;
}

export interface ExecutionStep {
  agent: AgentName;
  reason: string;
  priority: number;   // 1 = first, higher numbers run later, equal = parallel
}

export type AggregationMode = 'SII Aggregator' | 'partial' | 'none';

export interface OrchestratorResult {
  url: string;
  execution_plan: ExecutionStep[];
  parallel_execution: string[];
  final_aggregation: AggregationMode;
  confidence: number;
  optimization_notes: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FRESHNESS_TTL_HOURS = 24;
const LARGE_PAGE_WORD_THRESHOLD  = 2500;
const METADATA_HEAVY_TAG_THRESHOLD = 15;
const SII_MIN_AGENTS_REQUIRED    = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isFresh(r: StoredResult | undefined): boolean {
  return !!r?.fresh;
}

function isLargePage(m: PageMetrics | undefined): boolean {
  if (!m) return false;
  if (m.wordCount !== undefined && m.wordCount >= LARGE_PAGE_WORD_THRESHOLD) return true;
  if (m.pageCount !== undefined && m.pageCount > 10) return true;
  return false;
}

function isMetadataHeavy(m: PageMetrics | undefined): boolean {
  if (!m) return false;
  if (m.metaTagCount !== undefined && m.metaTagCount >= METADATA_HEAVY_TAG_THRESHOLD) return true;
  if (m.schemaMarkupDensity !== undefined && m.schemaMarkupDensity > 0.6) return true;
  return false;
}

function isNewPage(m: PageMetrics | undefined, existing: OrchestratorInput['existingResults']): boolean {
  if (m?.isNew === true) return true;
  return !existing || Object.keys(existing).length === 0;
}

// ── Priority assignment ───────────────────────────────────────────────────────
// Implements the dependency-respecting execution phases.
// Phase 1 = priority 1, Phase 2 = priority 2, Aggregator = priority 3.
// Within a phase, equal priority = eligible for parallel execution.

type AgentPriorityMap = Record<AgentName, number>;

function computePriorities(
  required: Set<AgentName>,
  input: OrchestratorInput,
): AgentPriorityMap {
  const p: AgentPriorityMap = {
    'Site Audit Agent':        1,
    'Entity Extraction Agent': 1,
    'AI Visibility Agent':     2,
    'Retrieval Analysis Agent': 2,
    'SII Aggregator':           3,
  };

  const { pageMetrics: m, userIntent } = input;

  // New page → entity + AI visibility are highest priority in their phases
  // (no reordering needed — they're already in optimal phases)

  // Large page → elevate Retrieval Analysis to Phase 1 (surface it earlier)
  if (isLargePage(m) && required.has('Retrieval Analysis Agent')) {
    p['Retrieval Analysis Agent'] = 1;
  }

  // Metadata-heavy → SEO Audit is the entry point; all others shift down
  if (isMetadataHeavy(m) && required.has('Site Audit Agent')) {
    p['Site Audit Agent'] = 1;
    // Entity and AI visibility still run but slightly deprioritised in scheduling
    if (required.has('Entity Extraction Agent')) p['Entity Extraction Agent'] = 1; // still parallel
  }

  // Intent-specific priority boosts within phases
  if (userIntent === 'retrieval_analysis' && required.has('Retrieval Analysis Agent')) {
    p['Retrieval Analysis Agent'] = Math.min(p['Retrieval Analysis Agent'], 1);
  }
  if (userIntent === 'entity_mapping' && required.has('Entity Extraction Agent')) {
    p['Entity Extraction Agent'] = 1; // already 1 but make explicit
  }

  return p;
}

// ── Parallel groups ───────────────────────────────────────────────────────────

function computeParallelGroups(
  plan: ExecutionStep[],
): string[] {
  const byPriority = new Map<number, AgentName[]>();
  for (const step of plan) {
    const list = byPriority.get(step.priority) ?? [];
    list.push(step.agent);
    byPriority.set(step.priority, list);
  }

  const groups: string[] = [];
  for (const [, agents] of [...byPriority.entries()].sort(([a], [b]) => a - b)) {
    if (agents.length > 1) {
      groups.push(agents.join(' || '));
    }
  }
  return groups;
}

// ── Confidence ────────────────────────────────────────────────────────────────

function computeConfidence(
  _required: Set<AgentName>,
  skipped: Set<AgentName>,
  input: OrchestratorInput,
): number {
  // Start at maximum confidence
  let confidence = 1.0;

  // Each skipped agent (beyond SII Aggregator) reduces confidence
  const AGENT_WEIGHTS: Partial<Record<AgentName, number>> = {
    'Site Audit Agent':        0.15,
    'Entity Extraction Agent': 0.25,
    'AI Visibility Agent':     0.30,
    'Retrieval Analysis Agent': 0.20,
  };

  for (const agent of skipped) {
    if (agent !== 'SII Aggregator') {
      confidence -= AGENT_WEIGHTS[agent] ?? 0.10;
    }
  }

  // Partial crawl reduces confidence
  if (input.crawlDataType === 'partial') confidence -= 0.12;

  // Very new page with no metrics reduces confidence
  if (!input.pageMetrics) confidence -= 0.05;

  return Math.round(Math.max(0.10, Math.min(1.0, confidence)) * 100) / 100;
}

// ── Reason generation ─────────────────────────────────────────────────────────

function buildReason(
  agent: AgentName,
  input: OrchestratorInput,
  skipped: Set<AgentName>,
  isNewP: boolean,
): string {
  const { pageMetrics: m, userIntent, crawlDataType, existingResults: ex } = input;

  if (skipped.has(agent)) return 'skipped'; // should not happen

  const cached = {
    'Site Audit Agent':        ex?.siteAudit,
    'AI Visibility Agent':     ex?.aiVisibility,
    'Entity Extraction Agent': ex?.entityExtraction,
    'Retrieval Analysis Agent': ex?.retrievalAnalysis,
    'SII Aggregator':           undefined,
  }[agent];

  if (cached && !cached.fresh) return `re-run: cached result is ${cached.ageHours}h old, exceeds ${FRESHNESS_TTL_HOURS}h TTL`;

  const reasons: string[] = [];

  switch (agent) {
    case 'Site Audit Agent':
      if (userIntent === 'seo_audit')      reasons.push('direct intent match: seo_audit');
      if (isMetadataHeavy(m))              reasons.push('metadata-heavy page detected; SEO signals dominant');
      if (crawlDataType === 'multi_page')  reasons.push('multi-page crawl requires site-wide SEO evaluation');
      if (reasons.length === 0)            reasons.push('required for SII seo_readability dimension');
      break;

    case 'Entity Extraction Agent':
      if (isNewP)                          reasons.push('new page: entity graph must be established before AI visibility scoring');
      if (userIntent === 'entity_mapping') reasons.push('direct intent match: entity_mapping');
      if (userIntent === 'full_intelligence') reasons.push('entity clarity is a required SII input');
      if (reasons.length === 0)            reasons.push('entity_clarity dimension required for SII computation');
      break;

    case 'AI Visibility Agent':
      if (isNewP)                          reasons.push('new page: AI readability baseline must be established');
      if (userIntent === 'ai_visibility')  reasons.push('direct intent match: ai_visibility');
      if (m?.hasDynamicContent)            reasons.push('dynamic content detected; AI extraction fidelity uncertain');
      if (reasons.length === 0)            reasons.push('ai_visibility + semantic_structure dimensions required for SII');
      break;

    case 'Retrieval Analysis Agent':
      if (isLargePage(m))                  reasons.push(`large page (${m?.wordCount ?? 'unknown'} words): chunk boundary and truncation analysis required`);
      if (crawlDataType === 'multi_page')  reasons.push('multi-page: cross-page retrieval coherence analysis needed');
      if (userIntent === 'retrieval_analysis') reasons.push('direct intent match: retrieval_analysis');
      if (reasons.length === 0)            reasons.push('retrieval_friendliness and citation_potential dimensions required for SII');
      break;

    case 'SII Aggregator':
      reasons.push('aggregates all dimension scores into final SII composite with weighted contributions');
      break;
  }

  return reasons.join('; ');
}

// ── Optimization notes ────────────────────────────────────────────────────────

function buildOptimizationNotes(
  required: Set<AgentName>,
  skipped: Set<AgentName>,
  input: OrchestratorInput,
  aggregation: AggregationMode,
): string[] {
  const notes: string[] = [];

  if (skipped.size > 0) {
    notes.push(`skipped ${skipped.size} agent(s) with fresh cached results — cache TTL: ${FRESHNESS_TTL_HOURS}h`);
  }

  const parallelPairs = required.has('Site Audit Agent') && required.has('Entity Extraction Agent');
  if (parallelPairs) {
    notes.push('Phase 1 parallelism: Site Audit + Entity Extraction run concurrently — no shared dependencies');
  }

  if (required.has('AI Visibility Agent') && required.has('Retrieval Analysis Agent')) {
    notes.push('Phase 2 parallelism: AI Visibility + Retrieval Analysis run concurrently after entity graph is available');
  }

  if (input.crawlDataType === 'partial') {
    notes.push('partial crawl: confidence reduced — full_page crawl recommended for complete SII');
  }

  if (aggregation === 'partial') {
    notes.push(`partial SII: ${4 - skipped.size} of 4 primary agents running — confidence adjusted for missing dimensions`);
  }

  if (aggregation === 'none') {
    notes.push('SII not computable: fewer than 3 required inputs available — run full intelligence scan');
  }

  if (input.pageMetrics?.isNew && required.has('Entity Extraction Agent')) {
    notes.push('new page detected: entity graph cold-start — future runs will benefit from cached entity baseline');
  }

  if (isLargePage(input.pageMetrics)) {
    notes.push('large page: Retrieval Analysis elevated to Phase 1 — chunk truncation is highest-risk failure mode');
  }

  return notes;
}

// ── Core routing function ─────────────────────────────────────────────────────

export function orchestrate(input: OrchestratorInput): OrchestratorResult {
  const { url, userIntent, existingResults: ex } = input;
  const m = input.pageMetrics;
  const isNewP = isNewPage(m, ex);

  // 1. Determine which agents to SKIP (fresh cached results available)
  const skipped = new Set<AgentName>();

  if (isFresh(ex?.siteAudit)        && userIntent !== 'seo_audit')         skipped.add('Site Audit Agent');
  if (isFresh(ex?.entityExtraction)  && userIntent !== 'entity_mapping')    skipped.add('Entity Extraction Agent');
  if (isFresh(ex?.aiVisibility)      && userIntent !== 'ai_visibility')     skipped.add('AI Visibility Agent');
  if (isFresh(ex?.retrievalAnalysis) && userIntent !== 'retrieval_analysis') skipped.add('Retrieval Analysis Agent');

  // New page override: always run entity + AI visibility regardless of cache
  if (isNewP) {
    skipped.delete('Entity Extraction Agent');
    skipped.delete('AI Visibility Agent');
  }

  // 2. Build required set
  const ALL_AGENTS: AgentName[] = [
    'Site Audit Agent',
    'Entity Extraction Agent',
    'AI Visibility Agent',
    'Retrieval Analysis Agent',
  ];

  const required = new Set<AgentName>(ALL_AGENTS.filter((a) => !skipped.has(a)));

  // 3. Determine aggregation mode
  let aggregation: AggregationMode;
  if (required.size >= SII_MIN_AGENTS_REQUIRED) {
    aggregation = required.size === 4 ? 'SII Aggregator' : 'partial';
  } else {
    aggregation = 'none';
  }

  if (aggregation !== 'none') required.add('SII Aggregator');

  // 4. Compute priority map
  const priorities = computePriorities(required, input);

  // 5. Build execution plan
  const execution_plan: ExecutionStep[] = [...required]
    .filter((a) => a !== 'SII Aggregator')
    .sort((a, b) => priorities[a] - priorities[b])
    .map((agent) => ({
      agent,
      reason: buildReason(agent, input, skipped, isNewP),
      priority: priorities[agent],
    }));

  // SII Aggregator always last
  if (aggregation !== 'none') {
    execution_plan.push({
      agent: 'SII Aggregator',
      reason: buildReason('SII Aggregator', input, skipped, isNewP),
      priority: priorities['SII Aggregator'],
    });
  }

  // 6. Parallel groups
  const parallel_execution = computeParallelGroups(
    execution_plan.filter((s) => s.agent !== 'SII Aggregator'),
  );

  // 7. Confidence
  const confidence = computeConfidence(required, skipped, input);

  // 8. Optimization notes
  const optimization_notes = buildOptimizationNotes(required, skipped, input, aggregation);

  return {
    url,
    execution_plan,
    parallel_execution,
    final_aggregation: aggregation,
    confidence,
    optimization_notes,
  };
}
