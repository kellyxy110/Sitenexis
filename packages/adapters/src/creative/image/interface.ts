// ImageGenerationCapability — canonical interface for all image generation adapters.

import type { ImageAsset, CreativeContext, CreativeProviderHealth } from '../types';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface ImageGenerationInput {
  prompt: string;
  negativePrompt?: string;
  width?: number;             // defaults to model's recommended width
  height?: number;
  steps?: number;             // diffusion steps
  guidanceScale?: number;     // classifier-free guidance scale
  seed?: number;              // for reproducibility
  aspectRatio?: string;       // "1:1" | "16:9" | "4:3" | "3:4" | "9:16"
  numImages?: number;         // batch size; defaults to 1; max 4
  outputFormat?: 'png' | 'jpeg' | 'webp';
  ctx?: CreativeContext;
}

// ── Capability constraints ────────────────────────────────────────────────────

export interface ImageModelConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  maxSteps: number;
  defaultSteps: number;
  supportsNegativePrompt: boolean;
  supportsGuidanceScale: boolean;
  supportsSeed: boolean;
  maxBatchSize: number;
  supportedAspectRatios?: string[];
  estimatedLatencyMs: number;      // p50 under normal load
}

// ── Adapter contract ──────────────────────────────────────────────────────────

export interface ImageGenerationAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly tier: 'primary' | 'fallback' | 'research';
  readonly constraints: ImageModelConstraints;
  isConfigured(): boolean;
  generate(input: ImageGenerationInput): Promise<ImageAsset>;
  healthCheck(): Promise<CreativeProviderHealth>;
}
