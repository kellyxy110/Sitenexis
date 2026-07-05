// AIInferenceRegistry — runtime provider selection with automatic fallback.
// Business logic calls aiRegistry.execute() and never deals with provider selection.

import type {
  AIInferenceAdapter,
  AICompletionInput,
  AICompletionOutput,
  AICallMetrics,
} from './interface';
import { getGroqAdapter } from './groq.adapter';

export class AIInferenceError extends Error {
  readonly provider: string;
  constructor(message: string, provider = 'unknown') {
    super(message);
    this.name = 'AIInferenceError';
    this.provider = provider;
  }
}

interface RegistryEntry {
  name: string;
  tier: 'primary' | 'fallback' | 'experimental';
  adapter: AIInferenceAdapter;
}

const TIER_ORDER: Record<RegistryEntry['tier'], number> = {
  primary: 0,
  fallback: 1,
  experimental: 2,
};

class AIInferenceRegistry {
  private entries: RegistryEntry[] = [];
  private metricsHandlers: Array<(m: AICallMetrics) => void> = [];

  register(
    name: string,
    tier: RegistryEntry['tier'],
    adapter: AIInferenceAdapter,
  ): void {
    this.entries = this.entries.filter((e) => e.name !== name);
    this.entries.push({ name, tier, adapter });
    this.entries.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  }

  /** Subscribe to per-call metrics — used for cost tracking and observability */
  onMetrics(handler: (m: AICallMetrics) => void): void {
    this.metricsHandlers.push(handler);
  }

  private emit(m: AICallMetrics): void {
    for (const h of this.metricsHandlers) {
      try { h(m); } catch { /* metrics never throw */ }
    }
  }

  /**
   * Execute with automatic fallback across tiers.
   * Primary adapters are tried first; on failure, fallback tier is tried.
   * If the registry is empty or nothing is configured, falls back to Groq directly
   * to preserve backward compatibility with existing callAI() behavior.
   */
  async execute(input: AICompletionInput): Promise<AICompletionOutput> {
    const configured = this.entries.filter((e) => e.adapter.isConfigured());

    if (configured.length === 0) {
      return this.groqLastResort(input);
    }

    let lastErr: unknown;

    for (const entry of configured) {
      const start = Date.now();
      try {
        const output = await entry.adapter.complete(input);
        const costUsd = estimateCost(entry.adapter.provider, output.inputTokens, output.outputTokens);
        this.emit({
          provider: entry.adapter.provider,
          model: output.model,
          latencyMs: output.latencyMs,
          success: true,
          timestamp: new Date(),
          ...(output.inputTokens !== undefined ? { inputTokens: output.inputTokens } : {}),
          ...(output.outputTokens !== undefined ? { outputTokens: output.outputTokens } : {}),
          ...(input.ctx?.auditId !== undefined ? { auditId: input.ctx.auditId } : {}),
          ...(input.ctx?.traceId !== undefined ? { traceId: input.ctx.traceId } : {}),
          ...(costUsd !== undefined ? { estimatedCostUsd: costUsd } : {}),
        });
        return output;
      } catch (err) {
        const errCode = err instanceof Error ? err.message.slice(0, 64) : 'unknown';
        this.emit({
          provider: entry.adapter.provider,
          model: input.model,
          latencyMs: Date.now() - start,
          success: false,
          timestamp: new Date(),
          errorCode: errCode,
          ...(input.ctx?.auditId !== undefined ? { auditId: input.ctx.auditId } : {}),
          ...(input.ctx?.traceId !== undefined ? { traceId: input.ctx.traceId } : {}),
        });
        lastErr = err;
      }
    }

    throw lastErr ?? new AIInferenceError('All AI providers failed');
  }

  /** Get a named adapter (e.g. for direct calls that bypass fallback) */
  get(name: string): AIInferenceAdapter | undefined {
    return this.entries.find((e) => e.name === name)?.adapter;
  }

  /** Names of all registered adapters */
  list(): string[] {
    return this.entries.map((e) => `${e.name}(${e.tier})`);
  }

  private async groqLastResort(input: AICompletionInput): Promise<AICompletionOutput> {
    const groq = getGroqAdapter();
    if (!groq.isConfigured()) {
      throw new AIInferenceError('No AI provider configured — set GROQ_API_KEY or register a provider');
    }
    return groq.complete({
      ...input,
      model: input.model ?? 'llama-3.3-70b-versatile',
    });
  }
}

// ── Cost estimate hooks ───────────────────────────────────────────────────────
// Rates are per-token estimates — informational only, not billed values.

const COST_RATES: Record<string, { in: number; out: number }> = {
  groq:       { in: 0.00000059, out: 0.00000079 },  // llama-3.3-70b (approx)
  openrouter: { in: 0.0000007,  out: 0.0000009  },  // free-tier average
  openai:     { in: 0.0000025,  out: 0.0000100  },  // gpt-4o
  anthropic:  { in: 0.000003,   out: 0.000015   },  // claude-sonnet
};

function estimateCost(
  provider: string,
  inputTokens?: number,
  outputTokens?: number,
): number | undefined {
  if (!inputTokens && !outputTokens) return undefined;
  const rates = COST_RATES[provider];
  if (!rates) return undefined;
  return (inputTokens ?? 0) * rates.in + (outputTokens ?? 0) * rates.out;
}

export { AIInferenceRegistry };

// ── Singleton ─────────────────────────────────────────────────────────────────

export const aiRegistry = new AIInferenceRegistry();
