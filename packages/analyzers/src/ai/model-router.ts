import { callOpenRouter, callOpenRouterVision, isOpenRouterConfigured, OR_MODELS } from './openrouter';
import { callBynara, isBynaraConfigured, BYNARA_MODELS } from './bynara-client';
import type { OpenRouterOptions } from './openrouter';

// ─── Task type registry ───────────────────────────────────────────────────────

export type AITaskType =
  | 'structured_scoring'      // Hermes 3 405B — reliable JSON scoring output
  | 'entity_extraction'       // Hermes 3 405B — precise entity disambiguation
  | 'whole_site_analysis'     // DeepSeek V4 Flash — 1M context, full site
  | 'contradiction_detection' // DeepSeek V4 Flash — reasoning mode for cross-page analysis
  | 'code_generation'         // Kimi K2.6 — production-ready JSON-LD, HTML, fix code
  | 'schema_generation'       // Kimi K2.6 — structured data specialist
  | 'landing_page_generation' // Kimi K2.6 — UI/UX generation
  | 'visual_analysis'         // Gemma 4 31B — multimodal page/ad analysis
  | 'visual_ad_review'        // Gemma 4 31B — ad creative review
  | 'rag_simulation'          // Qwen3-Next — RAG-optimised retrieval simulation
  | 'high_throughput'         // Qwen3-Next — MoE efficiency, no thinking traces
  | 'multilingual_analysis'   // Llama 3.3 70B — 8-language support
  | 'ad_generation'           // Hermes 3 → Kimi fallback — ad copy + campaign
  | 'performance_prediction' // DeepSeek — reasoning for ad performance modeling
  | 'scout_intent_classification'  // Qwen primary — page intent classification
  | 'scout_reasoning';             // Qwen primary — general Scout reasoning tasks

/** Primary model assignment per task type */
const TASK_MODEL_MAP: Record<AITaskType, (typeof OR_MODELS)[keyof typeof OR_MODELS]> = {
  structured_scoring:       OR_MODELS.HERMES,
  entity_extraction:        OR_MODELS.HERMES,
  whole_site_analysis:      OR_MODELS.DEEPSEEK,
  contradiction_detection:  OR_MODELS.DEEPSEEK,
  code_generation:          OR_MODELS.KIMI,
  schema_generation:        OR_MODELS.KIMI,
  landing_page_generation:  OR_MODELS.KIMI,
  visual_analysis:          OR_MODELS.GEMMA,
  visual_ad_review:         OR_MODELS.GEMMA,
  rag_simulation:           OR_MODELS.QWEN,
  high_throughput:          OR_MODELS.QWEN,
  multilingual_analysis:    OR_MODELS.LLAMA,
  ad_generation:            OR_MODELS.HERMES,
  performance_prediction:   OR_MODELS.DEEPSEEK,
  scout_intent_classification: OR_MODELS.QWEN,
  scout_reasoning:             OR_MODELS.QWEN,
};

/** Fallback chain when primary model key is not configured */
const FALLBACK_MAP: Partial<Record<AITaskType, (typeof OR_MODELS)[keyof typeof OR_MODELS][]>> = {
  structured_scoring:      [OR_MODELS.QWEN, OR_MODELS.DEEPSEEK],
  entity_extraction:       [OR_MODELS.QWEN, OR_MODELS.LLAMA],
  whole_site_analysis:     [OR_MODELS.QWEN],
  contradiction_detection: [OR_MODELS.QWEN],
  code_generation:         [OR_MODELS.HERMES],
  schema_generation:       [OR_MODELS.HERMES],
  ad_generation:           [OR_MODELS.KIMI, OR_MODELS.QWEN],
  performance_prediction:  [OR_MODELS.HERMES],
  scout_intent_classification: [OR_MODELS.HERMES, OR_MODELS.DEEPSEEK],
  scout_reasoning:             [OR_MODELS.DEEPSEEK, OR_MODELS.HERMES],
};

function selectModel(task: AITaskType): (typeof OR_MODELS)[keyof typeof OR_MODELS] | null {
  const primary = TASK_MODEL_MAP[task];
  if (isOpenRouterConfigured(primary)) return primary;

  const fallbacks = FALLBACK_MAP[task] ?? [];
  for (const fallback of fallbacks) {
    if (isOpenRouterConfigured(fallback)) return fallback;
  }

  return null;
}

// ─── Router functions ─────────────────────────────────────────────────────────

/**
 * Route a text task to the best available OpenRouter model for the task type.
 * Returns null if no model is configured (callers fall back to Groq).
 */
export async function routeTask<T>(
  task: AITaskType,
  systemPrompt: string,
  userPrompt: string,
  opts: OpenRouterOptions = {},
): Promise<T | null> {
  const model = selectModel(task);
  if (!model) return null;

  try {
    return await callOpenRouter<T>(model, systemPrompt, userPrompt, opts);
  } catch (err) {
    console.error(`[model-router] ${task} failed on ${model}:`, err instanceof Error ? err.message : String(err));

    // Try fallbacks on error
    const fallbacks = FALLBACK_MAP[task] ?? [];
    for (const fallback of fallbacks) {
      if (fallback === model) continue;
      if (!isOpenRouterConfigured(fallback)) continue;
      try {
        return await callOpenRouter<T>(fallback, systemPrompt, userPrompt, opts);
      } catch {
        continue;
      }
    }

    return null;
  }
}

/**
 * Route a vision task (image + text) to the best available multimodal model.
 */
export async function routeVisionTask<T>(
  task: 'visual_analysis' | 'visual_ad_review',
  systemPrompt: string,
  textPrompt: string,
  imageBase64OrUrl: string,
  opts: OpenRouterOptions = {},
): Promise<T | null> {
  const model = selectModel(task);
  if (!model) return null;

  // Vision only works on Gemma and Kimi
  const visionModel = (model === OR_MODELS.GEMMA || model === OR_MODELS.KIMI)
    ? model as typeof OR_MODELS.GEMMA | typeof OR_MODELS.KIMI
    : OR_MODELS.GEMMA;

  if (!isOpenRouterConfigured(visionModel)) return null;

  try {
    return await callOpenRouterVision<T>(visionModel, systemPrompt, textPrompt, imageBase64OrUrl, opts);
  } catch (err) {
    console.error(`[model-router] ${task} vision failed:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Route a text task to the best available provider, with Bynara (mistral-large) as
 * a second-tier fallback when no OpenRouter model is configured for the task.
 * Callers that already fall back to Groq can remain unchanged — Bynara is tried
 * before Groq when both OpenRouter and the Groq path return null.
 *
 * Usage: same signature as routeTask; returns null when all providers unavailable.
 */
export async function routeTaskWithBynara<T>(
  task: AITaskType,
  systemPrompt: string,
  userPrompt: string,
  opts: OpenRouterOptions = {},
): Promise<T | null> {
  // 1. Try OpenRouter
  const orResult = await routeTask<T>(task, systemPrompt, userPrompt, opts);
  if (orResult !== null) return orResult;

  // 2. Fall back to Bynara (mistral-large)
  if (!isBynaraConfigured()) return null;
  try {
    const bynaraOpts: import('./bynara-client').BynaraOptions = {};
    if (opts.temperature !== undefined) bynaraOpts.temperature = opts.temperature;
    if (opts.maxTokens   !== undefined) bynaraOpts.maxTokens   = opts.maxTokens;
    if (opts.jsonMode    !== undefined) bynaraOpts.jsonMode    = opts.jsonMode;
    return await callBynara<T>(BYNARA_MODELS.MISTRAL_LARGE, systemPrompt, userPrompt, bynaraOpts);
  } catch (err) {
    console.error(`[model-router] Bynara fallback failed for ${task}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Check whether any OpenRouter model is available (at least one key is set) */
export function isAnyOpenRouterAvailable(): boolean {
  return Object.values(OR_MODELS).some((m) => isOpenRouterConfigured(m));
}

/** Check whether any AI provider is available (OpenRouter, Bynara, or Groq) */
export function isAnyProviderAvailable(): boolean {
  return isAnyOpenRouterAvailable() || isBynaraConfigured();
}

/** Get a report of which models and providers are configured */
export function getModelAvailability(): Record<string, boolean> {
  return {
    ...Object.fromEntries(
      Object.entries(OR_MODELS).map(([name, model]) => [name, isOpenRouterConfigured(model)])
    ),
    bynara_mistral_large: isBynaraConfigured(),
  };
}

export { OR_MODELS, isOpenRouterConfigured, isBynaraConfigured, BYNARA_MODELS };
export type { OpenRouterOptions };
