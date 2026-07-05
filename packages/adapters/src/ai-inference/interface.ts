// AIInferenceCapability — canonical input/output types.
// All AI provider adapters translate to/from these types.
// Callers only ever import from this interface — never from provider SDKs.

export interface AIInferenceContext {
  auditId?: string;
  domain?: string;
  traceId?: string;
  timeoutMs?: number;   // hard deadline per call; defaults to 30 000 ms
  retries?: number;     // retry attempts on transient failure; defaults to 0
}

/** Input for a text/JSON chat completion */
export interface AICompletionInput {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;    // defaults to 0.1
  jsonMode?: boolean;      // request structured JSON output
  imageUrl?: string;       // base64 data or https:// URL — activates vision path
  ctx?: AIInferenceContext;
}

/** Normalized output from any provider */
export interface AICompletionOutput {
  content: string;         // raw string — callers call parseAIResponse<T>() if JSON
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

/** Input for embedding generation */
export interface AIEmbeddingInput {
  texts: string[];
  model?: string;
  ctx?: AIInferenceContext;
}

export interface AIEmbeddingOutput {
  embeddings: number[][];
  model: string;
  provider: string;
  inputTokens?: number;
  latencyMs: number;
}

/** Per-call metrics — emitted after every execute(), success or failure */
export interface AICallMetrics {
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  errorCode?: string;
  auditId?: string;
  traceId?: string;
  timestamp: Date;
  estimatedCostUsd?: number;
}

/** Health probe result */
export interface AIProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  checkedAt: Date;
  details?: string;
}

/** Contract every provider adapter must implement */
export interface AIInferenceAdapter {
  readonly provider: string;
  readonly supportedModels: readonly string[];
  isConfigured(): boolean;
  complete(input: AICompletionInput): Promise<AICompletionOutput>;
  embed?(input: AIEmbeddingInput): Promise<AIEmbeddingOutput>;
  healthCheck(): Promise<AIProviderHealth>;
}
