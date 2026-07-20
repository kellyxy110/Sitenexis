// SiteNexis Skill Framework — Groq-only, dependency-free.
// A "skill" is a named, versioned, independently testable AI capability unit:
// a typed input, a description of when to use it, and a prompt builder. This
// packages the ~10 flat prompt functions in packages/analyzers/src/ai/prompts.ts
// into discoverable, composable units without any provider SDK or third-party
// skill-runtime code — inspired by the *idea* of Anthropic's Skills (a named
// capability with a "when to use" trigger), not its implementation.

/** The two-part prompt every Groq/OpenRouter completion call needs. */
export interface SkillPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * A single reusable AI capability. TInput is whatever shape the underlying
 * prompt builder needs (title+bodyExcerpt, two pages to compare, etc.) —
 * there is no forced uniform shape, since the prompts this wraps already
 * have real, different argument sets.
 */
export interface SkillDefinition<TInput = unknown> {
  /** Stable identifier, kebab-case, never reused for a different capability. */
  readonly id: string;
  /** Bump on any meaningful change to the prompt/scoring rubric this skill produces. */
  readonly version: string;
  /** What this skill does, one or two sentences. */
  readonly description: string;
  /** When a caller should pick this skill over another — the discovery signal. */
  readonly whenToUse: string;
  /** Optional hint into model-router's AITaskType registry (kept as a plain string here so
   *  packages/adapters never depends on packages/analyzers — analyzers narrows this itself). */
  readonly recommendedTaskType?: string;
  /** Pure function: input in, the two-part prompt out. Never calls a provider itself. */
  buildPrompt(input: TInput): SkillPrompt;
}

/** The subset of a SkillDefinition safe to expose in a discovery/listing UI (no buildPrompt). */
export type SkillManifest = Pick<SkillDefinition, 'id' | 'version' | 'description' | 'whenToUse' | 'recommendedTaskType'>;
