# AIInferenceCapability

**Version:** 1.0  
**Package:** `@sitenexis/adapters`  
**Status:** Production

---

## Purpose

AIInferenceCapability is the reference implementation of the SiteNexis Capability Framework. It provides a single, provider-agnostic interface for all AI text completion and web-search calls across the platform.

Before this implementation, every module that needed AI inference imported provider SDKs directly (`openai`, raw `fetch` to Groq/Anthropic endpoints), creating a fragmented, untestable, and fragile dependency surface. AIInferenceCapability consolidates all of that into one contract.

**The rule it enforces:** business logic never imports a provider SDK. It calls `AIInferenceAdapter.complete()` and receives a normalized `AICompletionOutput`. Providers are replaceable without touching a single analyzer module.

---

## Interface Summary

```typescript
// Every provider implements this
interface AIInferenceAdapter {
  readonly provider: string;
  readonly supportedModels: readonly string[];
  isConfigured(): boolean;
  complete(input: AICompletionInput): Promise<AICompletionOutput>;
  embed?(input: AIEmbeddingInput): Promise<AIEmbeddingOutput>;
  healthCheck(): Promise<AIProviderHealth>;
}

// Normalized input — same shape for every provider
interface AICompletionInput {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;       // default 0.1
  jsonMode?: boolean;
  imageUrl?: string;          // activates vision path
  ctx?: AIInferenceContext;   // traceId, auditId, timeout
}

// Normalized output — provider-specific formats erased
interface AICompletionOutput {
  content: string;            // raw string; callers call parseAIResponse<T>() if JSON
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}
```

`parseAIResponse<T>()` remains in `packages/analyzers/src/ai/prompts.ts`. Adapters return raw content strings — parsing is the caller's responsibility, keeping adapters free of business logic.

---

## Provider List

| Name | `provider` string | SDK | Notes |
|---|---|---|---|
| Groq | `groq` | `openai` (OpenAI-compatible) | Primary fast path; llama-3.3-70b-versatile (standard), llama-3.1-8b-instant (fast) |
| OpenRouter | `openrouter` | `openai` (OpenAI-compatible) | Multi-model fallback; free-tier models; vision support |
| OpenAI | `openai` | `openai` | Real OpenAI; includes `webSearch()` via Responses API for citation-check |
| Anthropic | `anthropic` | raw `fetch` | No `@anthropic-ai/sdk` added; claude-sonnet-4-6 |

All four providers live exclusively in `packages/adapters/src/ai-inference/`. No other package imports any provider SDK.

---

## Registry Behavior

`AIInferenceRegistry` is the unified execution path. Business code calls `aiRegistry.execute(input)` and never deals with provider selection.

### Registration

```typescript
import { aiRegistry, getGroqAdapter, getOpenRouterAdapter } from '@sitenexis/adapters';

aiRegistry.register('groq', 'primary', getGroqAdapter());
aiRegistry.register('openrouter', 'fallback', getOpenRouterAdapter(model, apiKey));
```

Tiers: `primary` → `fallback` → `experimental`. Adapters are sorted by tier at registration time.

### Execution order

1. Filter to configured adapters (`isConfigured() === true`).
2. Iterate in tier order. On success: return output and emit metrics.
3. On failure: emit failure metrics, continue to next tier.
4. If all fail: rethrow the last error.
5. If no adapters are registered: fall back directly to `getGroqAdapter()` for backward compatibility.

---

## Fallback Rules

| Scenario | Behavior |
|---|---|
| Primary adapter throws | Try next tier in order |
| Adapter `isConfigured()` returns false | Skip silently |
| All adapters fail | Rethrow last error |
| Registry empty, Groq key present | Groq called directly (backward compat) |
| Registry empty, no Groq key | Throw `AIInferenceError` |

The fallback chain is automatic — callers do not implement try/catch around providers.

---

## Metrics Emitted

Every call (success and failure) emits an `AICallMetrics` object to all registered handlers.

```typescript
interface AICallMetrics {
  provider: string;           // which adapter ran
  model: string;              // model string used
  latencyMs: number;          // wall-clock time for the complete() call
  inputTokens?: number;       // from provider usage, if available
  outputTokens?: number;      // from provider usage, if available
  success: boolean;           // true = output returned, false = threw
  errorCode?: string;         // first 64 chars of error message (failure only)
  auditId?: string;           // from ctx.auditId if provided
  traceId?: string;           // from ctx.traceId if provided
  timestamp: Date;            // call start time
  estimatedCostUsd?: number;  // cost hook — informational only, not billed
}
```

Subscribe to metrics:

```typescript
aiRegistry.onMetrics((m) => {
  logger.info(m, 'ai-call');
  // or push to your observability pipeline
});
```

Metrics handlers never throw (errors in handlers are swallowed).

**API key safety:** No key value ever appears in a metrics object, error message, or log. Error messages include only the env var *name* as a hint (e.g., "GROQ_API_KEY not configured").

---

## Cost Estimation

`estimatedCostUsd` is populated from a static rate table in `registry.ts`. It is informational — not a billing figure.

| Provider | Input ($/token) | Output ($/token) |
|---|---|---|
| groq | $0.00000059 | $0.00000079 |
| openrouter | $0.0000007 | $0.0000009 |
| openai | $0.0000025 | $0.0000100 |
| anthropic | $0.000003 | $0.000015 |

Update rates in `packages/adapters/src/ai-inference/registry.ts` → `COST_RATES`.

---

## Example Usage

### Direct adapter call (adnexis pattern — caller-supplied key)

```typescript
import { makeGroqAdapter, makeAnthropicAdapter } from '@sitenexis/adapters';
import { parseAIResponse } from '../ai/prompts.js';

const output = await makeGroqAdapter(apiKey).complete({
  systemPrompt: SYSTEM_PROMPT,
  userPrompt: buildPrompt(ctx),
  model: 'llama-3.3-70b-versatile',
  maxTokens: 1500,
  temperature: 0.2,
  jsonMode: true,
});
const result = parseAIResponse<MyType>(output.content);
```

### Registry call (analyzer modules — environment key)

```typescript
import { aiRegistry } from '@sitenexis/adapters';
import { parseAIResponse } from './prompts';

const output = await aiRegistry.execute({
  systemPrompt: SYSTEM_PROMPT,
  userPrompt: buildPrompt(data),
  model: 'llama-3.3-70b-versatile',
  ctx: { auditId, traceId },
});
const result = parseAIResponse<MyType>(output.content);
```

### OpenAI web search (citation-check route)

```typescript
import { getOpenAIAdapter } from '@sitenexis/adapters';

const { content, citations } = await getOpenAIAdapter().webSearch(
  query,
  'gpt-4o-search-preview',
);
```

### With trace context and timeout

```typescript
const output = await aiRegistry.execute({
  systemPrompt,
  userPrompt,
  model: 'llama-3.3-70b-versatile',
  ctx: {
    auditId: job.id,
    traceId: crypto.randomUUID(),
    timeoutMs: 20_000,
  },
});
```

---

## Known Limitations

1. **Retry logic not implemented.** `ctx.retries` is defined in the interface but not yet acted on. Callers must implement retries at the call site if needed.
2. **Embedding not wired.** `AIEmbeddingAdapter.embed()` is defined but no adapter implements it yet. Embeddings currently go through Groq's embedding endpoints via their existing code path.
3. **`aiRegistry` singleton not pre-populated.** The registry starts empty. Each entry point (analyzer worker, serverless function) that uses `aiRegistry.execute()` must register adapters at startup, or call the adapter directly. The existing `callAI()` in `client.ts` handles this via its own routing logic.
4. **OpenRouter rate limiter is per-process.** The `ModelRateLimiter` in `openrouter.ts` is in-memory. Under multi-worker deployments, rate limiting is not coordinated across processes.
5. **Cost estimates are static approximations.** Rates are not fetched from provider APIs and may drift from actual billing.
6. **Vision path tested manually only.** The `imageUrl` path in `OpenRouterAdapter` and `OpenAIAdapter` has unit tests for the interface contract but no integration tests with real images.
7. **`webSearch()` is OpenAI-only.** The Responses API with `web_search_preview` is only available on OpenAI. There is no cross-provider web search fallback.

---

## How to Add a New Provider

1. Create `packages/adapters/src/ai-inference/[provider].adapter.ts` implementing `AIInferenceAdapter`.
2. The adapter must never import a provider SDK outside `packages/adapters`.
3. `isConfigured()` must return false when the key is absent or placeholder — never throw.
4. `healthCheck()` must return `{ status: 'unavailable' }` if not configured — never make a network call when unconfigured.
5. `complete()` must return a normalized `AICompletionOutput` — erase all provider-specific response shapes.
6. Handle optional properties with spread syntax to satisfy `exactOptionalPropertyTypes: true`:
   ```typescript
   return {
     content,
     model,
     provider: 'myprovider',
     latencyMs: Date.now() - start,
     ...(inputTokens !== undefined ? { inputTokens } : {}),
   };
   ```
7. Export a singleton factory (`getMyProviderAdapter()`) and a caller-key factory (`makeMyProviderAdapter(apiKey)`).
8. Add exports to `packages/adapters/src/ai-inference/index.ts`.
9. Add a cost rate entry to `COST_RATES` in `registry.ts`.
10. Write unit tests in `__tests__/[provider].adapter.test.ts` covering: success, empty content, unconfigured key, health probe.

---

## Files Changed

### New files

| File | Purpose |
|---|---|
| `packages/adapters/package.json` | New package `@sitenexis/adapters` |
| `packages/adapters/tsconfig.json` | TypeScript config (noEmit, extends base) |
| `packages/adapters/vitest.config.ts` | Vitest config for unit tests |
| `packages/adapters/src/index.ts` | Package entry point |
| `packages/adapters/src/ai-inference/interface.ts` | Canonical types for all adapters |
| `packages/adapters/src/ai-inference/groq.adapter.ts` | Groq adapter (OpenAI-compatible SDK) |
| `packages/adapters/src/ai-inference/openrouter.adapter.ts` | OpenRouter adapter (OpenAI-compatible SDK) |
| `packages/adapters/src/ai-inference/openai.adapter.ts` | Real OpenAI adapter + Responses API webSearch |
| `packages/adapters/src/ai-inference/anthropic.adapter.ts` | Anthropic adapter (raw fetch) |
| `packages/adapters/src/ai-inference/registry.ts` | Provider registry with fallback + metrics |
| `packages/adapters/src/ai-inference/index.ts` | Barrel exports |
| `packages/adapters/src/ai-inference/__tests__/groq.adapter.test.ts` | 8 unit tests |
| `packages/adapters/src/ai-inference/__tests__/registry.test.ts` | 11 unit tests |
| `packages/shared/src/capabilities/types.ts` | Base Capability Framework types |
| `docs/capabilities/ai-inference.md` | This document |

### Modified files

| File | Change |
|---|---|
| `packages/shared/src/index.ts` | Re-export capability types |
| `packages/analyzers/package.json` | Removed `openai`; added `@sitenexis/adapters` dep |
| `packages/analyzers/src/ai/client.ts` | Removed `import OpenAI`; uses `getGroqAdapter()` |
| `packages/analyzers/src/ai/groq-client.ts` | Removed `import OpenAI`; uses `getGroqFastAdapter()` |
| `packages/analyzers/src/ai/openrouter.ts` | Removed `import OpenAI`; uses `getOpenRouterAdapter()` |
| `packages/analyzers/src/adnexis/analyzer.ts` | Replaced raw fetch helpers with adapter calls |
| `packages/analyzers/src/adnexis/landing-page.ts` | Replaced raw Groq fetch with `makeGroqAdapter()` |
| `packages/analyzers/src/adnexis/regenerator.ts` | Replaced raw Anthropic/Groq fetch with adapter calls |
| `packages/analyzers/src/fixes/groq.ts` | Replaced raw fetch with `makeGroqAdapter(apiKey).complete()` |
| `apps/web/package.json` | Removed `openai`; added `@sitenexis/adapters` dep |
| `apps/web/next.config.ts` | Added `@sitenexis/adapters` to `transpilePackages` |
| `apps/web/tsconfig.json` | Added path alias for `@sitenexis/adapters` |
| `apps/web/src/lib/serverless-audit.ts` | Replaced 2 raw Groq fetch functions with `getGroqAdapter()` |
| `apps/web/src/app/api/citation-check/route.ts` | Removed `import OpenAI`; uses `getOpenAIAdapter().webSearch()` |
