/**
 * Weighted stage/phase definitions — the ONLY place stage weights live.
 *
 * The real pipeline does not execute as 7 discrete sequential phases (see
 * CLAUDE.md §28 execution phases and serverless-audit.ts) — several agents run
 * concurrently inside one Promise.all. Where the spec's suggested lifecycle
 * names a stage that has no independently observable signal in the current
 * agentManifest (e.g. VALIDATING_SITE / DISCOVERING_URLS are fused into the
 * single 'crawl' agent's running→completed transition), phases are merged and
 * that merge is documented here rather than left implicit.
 */

import type { AuditProgressStage } from './types';

export interface ProgressPhase {
  id: AuditProgressStage;
  label: string;
  activityLabel: string;
  /** Points out of 100 this phase contributes when fully complete. */
  weight: number;
  /** Agent keys (from AuditAgentManifest.agents) that gate this phase's completion. */
  agentKeys: string[];
}

// Weights mirror the spec exactly: Discovery 10 + Crawl 25 = 35 (merged, no
// separate signal); Extraction 20 + SEO 10 = 30 (merged — extraction of the
// link graph / machine-readability score happens in the same synchronous burst
// as the seo/schema agents, with no separate agent key); AI Intelligence 15;
// Citation/Trust 10; Report Assembly 10. Total = 100.
export const PROGRESS_PHASES: ProgressPhase[] = [
  {
    id: 'CRAWLING',
    label: 'Crawling site',
    activityLabel: 'Discovering and fetching pages',
    weight: 35,
    agentKeys: ['crawl'],
  },
  {
    id: 'ANALYSING_SEO',
    label: 'Analysing SEO & structure',
    activityLabel: 'Extracting content and evaluating SEO signals',
    weight: 30,
    agentKeys: ['seo', 'schema'],
  },
  {
    id: 'ANALYSING_AI_VISIBILITY',
    label: 'Analysing AI visibility',
    activityLabel: 'Evaluating machine-readable content and AI retrieval signals',
    weight: 15,
    // Entity/retrieval/citation/semantic-trust/performance/scout/governance all
    // run inside the same Promise.all in serverless-audit.ts — genuinely
    // concurrent, not sequential sub-stages.
    agentKeys: ['entity', 'retrieval', 'citation', 'semantic-trust', 'performance', 'scout', 'ai-governance'],
  },
  {
    id: 'ANALYSING_MACHINE_TRUST',
    label: 'Evaluating machine trust',
    activityLabel: 'Simulating retrieval and scoring machine trust signals',
    weight: 10,
    agentKeys: ['retrieval-simulation', 'machine-trust', 'temporal-authority', 'recommendation-mapping', 'synthetic-entity'],
  },
  {
    id: 'GENERATING_REPORT',
    label: 'Assembling intelligence report',
    activityLabel: 'Persisting results and assembling the intelligence report',
    weight: 10,
    agentKeys: ['reporting', 'infrastructure', 'visualization', 'information-gain'],
  },
];

export const TOTAL_WEIGHT = PROGRESS_PHASES.reduce((sum, p) => sum + p.weight, 0);

/** Human labels for module ids shown in the UI — falls back to the raw id. */
export const MODULE_LABELS: Record<string, string> = {
  'crawl': 'Crawl',
  'seo': 'Technical SEO',
  'schema': 'Schema markup',
  'entity': 'Entity intelligence',
  'retrieval': 'Retrieval readiness',
  'citation': 'Citation probability',
  'semantic-trust': 'Semantic trust',
  'performance': 'Performance',
  'scout': 'Scout (intent analysis)',
  'ai-governance': 'AI governance',
  'retrieval-simulation': 'Retrieval simulation',
  'machine-trust': 'Machine trust',
  'temporal-authority': 'Temporal authority',
  'recommendation-mapping': 'Recommendation surfaces',
  'synthetic-entity': 'Synthetic entity detection',
  'reporting': 'Report assembly',
  'infrastructure': 'Infrastructure',
  'visualization': 'Perception graph',
  'information-gain': 'Information gain',
};

export function moduleLabel(agentId: string): string {
  return MODULE_LABELS[agentId] ?? agentId;
}
