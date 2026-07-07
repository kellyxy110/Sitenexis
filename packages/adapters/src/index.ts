// @sitenexis/adapters — provider-agnostic adapter layer for all external integrations.
// Business logic imports capability interfaces from here, never from provider SDKs.

export * from './ai-inference/index';
export * from './web-extraction/index';
export * from './competitive-intelligence/index';
export * from './creative/index';

// Benchmark stubs — evaluation-only adapters, never in production registries.
// Import from '@sitenexis/adapters/benchmark' directly to avoid polluting the main bundle.
// Re-exported here for type-checking convenience only.
export type {
  FastReasoningAdapter,
  FastReasoningInput,
  FastReasoningOutput,
  LongContextReasoningAdapter,
  LongContextReasoningInput,
  LongContextReasoningOutput,
  LongFormReportAdapter,
  LongFormReportInput,
  LongFormReportOutput,
  AgenticReasoningAdapter,
  AgenticReasoningInput,
  AgenticReasoningOutput,
  AgenticReasoningStep,
} from './benchmark/index';
