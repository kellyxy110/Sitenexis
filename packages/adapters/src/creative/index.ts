// Creative Intelligence Capability Framework — barrel export.
// Import from '@sitenexis/adapters' — types, registries, adapters, benchmark.

// ── Canonical types ───────────────────────────────────────────────────────────
export type {
  ImageAsset,
  VideoAsset,
  VoiceAsset,
  ImageMimeType,
  VideoMimeType,
  AudioMimeType,
  CreativeContext,
  CreativeCallMetrics,
  CreativeProviderHealth,
} from './types';

// ── Security ──────────────────────────────────────────────────────────────────
export { validatePrompt, isValidPrompt, isTokenConfigured, PromptValidationError } from './security';

// ── Image generation ──────────────────────────────────────────────────────────
export type { ImageGenerationInput, ImageModelConstraints, ImageGenerationAdapter } from './image/interface';
export { HuggingFaceImageBase } from './image/huggingface.base';
export { FluxSchnellAdapter, getFluxSchnellAdapter } from './image/flux-schnell.adapter';
export { FluxDevAdapter, getFluxDevAdapter } from './image/flux-dev.adapter';
export { QwenImageAdapter, QwenImage2512Adapter, getQwenImageAdapter, getQwenImage2512Adapter } from './image/qwen.adapter';
export { KreaRawAdapter, KreaTurboAdapter, getKreaRawAdapter, getKreaTurboAdapter } from './image/krea.adapter';
export { Ideogram4Fp8Adapter, Ideogram4Nf4Adapter, getIdeogram4Fp8Adapter, getIdeogram4Nf4Adapter } from './image/ideogram.adapter';
export { FluxKleinAdapter, SulphurAdapter, getFluxKleinAdapter, getSulphurAdapter } from './image/research.adapters';
export { ImageGenerationRegistry, ImageGenerationError, imageRegistry } from './image/registry';

// ── Video generation ──────────────────────────────────────────────────────────
export type { VideoGenerationInput, VideoModelConstraints, VideoGenerationAdapter } from './video/interface';
export { HuggingFaceVideoBase } from './video/huggingface.base';
export { CogVideoX5bAdapter, getCogVideoX5bAdapter } from './video/cogvideox.adapter';
export { Ltx23Adapter, getLtx23Adapter } from './video/ltx.adapter';
export { Wan14BAdapter, getWan14BAdapter } from './video/wan.adapter';
export { VideoGenerationRegistry, VideoGenerationError, videoRegistry } from './video/registry';

// ── Voice generation ──────────────────────────────────────────────────────────
export type { VoiceGenerationInput, VoiceModelConstraints, VoiceGenerationAdapter } from './voice/interface';
export { KokoroAdapter, getKokoroAdapter } from './voice/kokoro.adapter';
export { VoiceGenerationRegistry, VoiceGenerationError, voiceRegistry } from './voice/registry';

// ── Creative planning ─────────────────────────────────────────────────────────
export type {
  CreativeBriefInput,
  CreativeDirection,
  CreativeImagePrompt,
  CreativeVideoPrompt,
  CopyVariant,
  CreativePlanningAdapter,
} from './planning/interface';

// ── Asset optimization ────────────────────────────────────────────────────────
export type {
  ImageOptimizationInput,
  VideoOptimizationInput,
  OptimizedImageAsset,
  OptimizedVideoAsset,
  AssetOptimizationAdapter,
} from './optimization/interface';
export { PLATFORM_PROFILES } from './optimization/interface';

// ── Image editing ─────────────────────────────────────────────────────────────
export type { ImageEditingInput, ImageEditingConstraints, ImageEditingAdapter } from './image-editing/interface';
export { QwenImageEditAdapter, getQwenImageEditAdapter } from './image-editing/qwen-image-edit.adapter';
export { ImageEditingRegistry, ImageEditingError, imageEditingRegistry } from './image-editing/registry';

// ── Benchmark ─────────────────────────────────────────────────────────────────
export type {
  ImageBenchmarkResult,
  VideoBenchmarkResult,
  BenchmarkSuite,
  BenchmarkSummary,
  ProviderSummary,
} from './benchmark';
export { CreativeBenchmarkRunner } from './benchmark';

// ── Creative benchmark stubs (evaluation-only, not production) ────────────────
export type {
  AdNexisCreativeBriefInput,
  AdNexisCreativeBriefOutput,
  LongFormCreativeBriefAdapter,
  CreativeAgentPlanInput,
  CreativeAgentPlanOutput,
  CreativeAgentPlanningAdapter,
  CreativeRoutingInput,
  CreativeRoutingDecision,
  FastCreativeRoutingAdapter,
} from './creative-benchmark-stubs';
export {
  PagestormCreativeBriefStub,
  GemmaCreativeAgentStub,
  OpenPanguCreativeRoutingStub,
  getPagestormCreativeBriefStub,
  getGemmaCreativeAgentStub,
  getOpenPanguCreativeRoutingStub,
} from './creative-benchmark-stubs';

// ── Top-level registry ────────────────────────────────────────────────────────
export { CreativeCapabilityRegistry, creativeRegistry } from './registry';
