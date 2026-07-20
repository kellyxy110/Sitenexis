// SiteNexis native Skill Framework — wraps the existing prompt-builder functions
// in prompts.ts as named, versioned, independently discoverable skills. This is
// packaging only: it never duplicates prompt logic and never changes the actual
// prompt text those functions already produce, so registering a skill cannot
// change any existing analyzer's output.
//
// Groq-only by design — no Claude/Anthropic-specific code, no third-party
// skill-runtime dependency. See CLAUDE.md "AI Retrieval + Machine Trust" for
// what each of these dimensions measures.

import type { SkillDefinition } from '@sitenexis/adapters';
import { skillRegistry } from '@sitenexis/adapters';
import {
  AI_SYSTEM_PROMPT,
  entityClarityPrompt,
  conversationalReadinessPrompt,
  aiExtractabilityPrompt,
  entityDetectionPrompt,
  groqEntityExtractionPrompt,
  claudeEntityDisambiguationPrompt,
  contradictionDetectionPrompt,
  hybridAuditReportPrompt,
  executiveSummaryPrompt,
  type HybridAuditContext,
} from './prompts';

const NARRATOR_SYSTEM_PROMPT =
  'You are the SiteNexis Hybrid Audit Narrator. You synthesize verified multi-agent outputs into ' +
  'structured intelligence reports. You never invent data. You always return a single valid JSON ' +
  'object with no surrounding text, explanation, or markdown.';

const EXEC_SUMMARY_SYSTEM_PROMPT =
  'You are the SiteNexis Executive Audit Narrator. You write professional prose assessment reports ' +
  'for website owners. You synthesize multi-agent audit data into readable editorial intelligence. ' +
  'You never invent data. Return a single valid JSON object only — no surrounding text, no markdown.';

const entityClaritySkill: SkillDefinition<{ title: string; bodyExcerpt: string }> = {
  id: 'entity-clarity-scoring',
  version: '1.0.0',
  description: 'Scores 0–25 on whether named entities on a page are explicitly identified, defined, and unambiguous.',
  whenToUse: 'Use when scoring the Entity Clarity dimension of AI Extractability for a single crawled page.',
  recommendedTaskType: 'structured_scoring',
  buildPrompt: ({ title, bodyExcerpt }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: entityClarityPrompt(title, bodyExcerpt),
  }),
};

const conversationalReadinessSkill: SkillDefinition<{ title: string; headings: string[]; bodyExcerpt: string }> = {
  id: 'conversational-readiness-scoring',
  version: '1.0.0',
  description: 'Scores 0–25 on whether a page directly answers natural-language queries (FAQ structure, H1/title-query alignment).',
  whenToUse: 'Use when scoring the Conversational Readiness dimension of AI Extractability for a single crawled page.',
  recommendedTaskType: 'structured_scoring',
  buildPrompt: ({ title, headings, bodyExcerpt }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: conversationalReadinessPrompt(title, headings, bodyExcerpt),
  }),
};

const aiExtractabilitySkill: SkillDefinition<{ title: string; bodyExcerpt: string }> = {
  id: 'ai-extractability-scoring',
  version: '1.0.0',
  description: 'Scores a page on chunk self-containment and summarisability — whether an AI system can derive clean meaning from it.',
  whenToUse: 'Use when scoring the Chunk Extractability / Summarisability dimensions of AI Extractability.',
  recommendedTaskType: 'structured_scoring',
  buildPrompt: ({ title, bodyExcerpt }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: aiExtractabilityPrompt(title, bodyExcerpt),
  }),
};

const entityDetectionSkill: SkillDefinition<{ title: string; bodyExcerpt: string }> = {
  id: 'entity-detection-cold',
  version: '1.0.0',
  description: 'Cold entity extraction (no prior candidate list) directly from raw page text — the AI-only fallback path.',
  whenToUse: 'Use when the fast Groq extraction stage is unavailable or unconfigured and entities must be extracted in one pass.',
  recommendedTaskType: 'structured_scoring',
  buildPrompt: ({ title, bodyExcerpt }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: entityDetectionPrompt(title, bodyExcerpt),
  }),
};

const groqEntityExtractionSkill: SkillDefinition<{ title: string; bodyExcerpt: string }> = {
  id: 'entity-extraction-fast',
  version: '1.0.0',
  description: 'Fast, low-cost first-pass entity candidate extraction using a small/fast model, before disambiguation.',
  whenToUse: 'Use as Stage 1 of the two-stage entity pipeline: cheap candidate generation before the disambiguation skill validates them.',
  buildPrompt: ({ title, bodyExcerpt }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: groqEntityExtractionPrompt(title, bodyExcerpt),
  }),
};

const entityDisambiguationSkill: SkillDefinition<{
  title: string;
  bodyExcerpt: string;
  groqResult: { entities: Array<{ name: string; type: string; mentionCount: number }>; summary: string };
}> = {
  id: 'entity-disambiguation',
  version: '1.0.0',
  description: 'Validates fast-extracted entity candidates, enriches with description/sameAs hints, and identifies the primary entity.',
  whenToUse: 'Use as Stage 2 of the two-stage entity pipeline, after entity-extraction-fast has produced candidates.',
  recommendedTaskType: 'entity_extraction',
  buildPrompt: ({ title, bodyExcerpt, groqResult }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: claudeEntityDisambiguationPrompt(title, bodyExcerpt, groqResult),
  }),
};

const contradictionDetectionSkill: SkillDefinition<{
  pageA: { url: string; excerpt: string };
  pageB: { url: string; excerpt: string };
}> = {
  id: 'contradiction-detection',
  version: '1.0.0',
  description: 'Detects factual contradictions between two page excerpts from the same domain (dates, claims, attributes).',
  whenToUse: 'Use for Semantic Trust cross-page contradiction checks, limited to the top pages by PageRank for cost control.',
  recommendedTaskType: 'contradiction_detection',
  buildPrompt: ({ pageA, pageB }) => ({
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: contradictionDetectionPrompt(pageA, pageB),
  }),
};

const hybridAuditReportSkill: SkillDefinition<HybridAuditContext> = {
  id: 'hybrid-audit-narrative-report',
  version: '1.0.0',
  description: 'Synthesizes verified multi-agent audit output into a structured narrative report (findings, recommendations, framing).',
  whenToUse: 'Use to generate the Narrative Report shown on the audit dashboard, after all Layer 1-4 agents have completed.',
  recommendedTaskType: 'whole_site_analysis',
  buildPrompt: (context) => ({
    systemPrompt: NARRATOR_SYSTEM_PROMPT,
    userPrompt: hybridAuditReportPrompt(context),
  }),
};

const executiveSummarySkill: SkillDefinition<HybridAuditContext> = {
  id: 'executive-summary',
  version: '1.0.0',
  description: 'Produces the six-section, X.X/10-scored executive prose summary of a completed audit for the website owner.',
  whenToUse: 'Use to generate the Executive Summary API response, after all Layer 1-4 agents have completed.',
  recommendedTaskType: 'whole_site_analysis',
  buildPrompt: (context) => ({
    systemPrompt: EXEC_SUMMARY_SYSTEM_PROMPT,
    userPrompt: executiveSummaryPrompt(context),
  }),
};

const CORE_SKILLS: SkillDefinition<any>[] = [
  entityClaritySkill,
  conversationalReadinessSkill,
  aiExtractabilitySkill,
  entityDetectionSkill,
  groqEntityExtractionSkill,
  entityDisambiguationSkill,
  contradictionDetectionSkill,
  hybridAuditReportSkill,
  executiveSummarySkill,
];

/** Registers every core SiteNexis skill. Safe to call more than once (register() is idempotent for unchanged versions). */
export function registerCoreSkills(): void {
  for (const skill of CORE_SKILLS) skillRegistry.register(skill);
}

export {
  entityClaritySkill,
  conversationalReadinessSkill,
  aiExtractabilitySkill,
  entityDetectionSkill,
  groqEntityExtractionSkill,
  entityDisambiguationSkill,
  contradictionDetectionSkill,
  hybridAuditReportSkill,
  executiveSummarySkill,
};
