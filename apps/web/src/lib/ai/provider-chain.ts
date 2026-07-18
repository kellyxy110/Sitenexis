/** Shared Groq + Hermes (OpenRouter) provider fallback chain — reused across any feature that needs an independent-provider AI call (SiteNexis Intelligence, Page Intelligence, future features). */
import { env } from '@/lib/env';
import type { AIInferenceAdapter, AICompletionInput, AICompletionOutput } from '@sitenexis/adapters';

const HERMES_MODEL = 'nousresearch/hermes-3-llama-3.1-405b:free';

export interface ProviderChoice {
  adapter: AIInferenceAdapter;
  model: string;
}

/** Groq primary, OpenRouter Hermes-3 fallback — two independent providers, so one outage doesn't take the feature down. */
export async function getGroqAndHermesProviders(): Promise<ProviderChoice[]> {
  const { getGroqAdapter, getOpenRouterAdapter } = await import('@sitenexis/adapters');
  return [
    { adapter: getGroqAdapter(), model: 'llama-3.3-70b-versatile' },
    { adapter: getOpenRouterAdapter(HERMES_MODEL, env.OPENROUTER_HERMES_KEY || env.OPENROUTER_API_KEY), model: HERMES_MODEL },
  ].filter((p) => p.adapter.isConfigured());
}

/** Try each provider in order — independent failures, not retries of the same one. Throws the last error if every provider fails. */
export async function completeWithFallback(
  providers: ProviderChoice[],
  input: Omit<AICompletionInput, 'model'>,
): Promise<AICompletionOutput> {
  let lastErr: unknown;
  for (const p of providers) {
    try {
      return await p.adapter.complete({ ...input, model: p.model });
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr ?? new Error('No AI provider available');
}
