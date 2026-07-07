// SiteNexis benchmark stubs — evaluation-only adapters.
// None of these adapters are registered in any production registry.
// Import directly for benchmarking and integration review only.

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
} from './interface';

export {
  OpenPanguFastReasoningStub,
  LongCatReasoningStub,
  PagestormReportStub,
  GemmaAgenticReasoningStub,
  getOpenPanguFastReasoningStub,
  getLongCatReasoningStub,
  getPagestormReportStub,
  getGemmaAgenticReasoningStub,
} from './sitenexis-stubs';
