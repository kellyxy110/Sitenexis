// VideoGenerationCapability — canonical interface for all video generation adapters.

import type { VideoAsset, CreativeContext, CreativeProviderHealth } from '../types';

export interface VideoGenerationInput {
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;             // image-to-video: base64 data URI or https URL
  imageBuffer?: Buffer;          // image-to-video: raw image bytes
  durationSeconds?: number;      // target duration; defaults to model max
  fps?: number;                  // frames per second; defaults to model default
  width?: number;
  height?: number;
  seed?: number;
  guidanceScale?: number;
  numFrames?: number;            // explicit frame count; overrides durationSeconds
  ctx?: CreativeContext;
}

export interface VideoModelConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  defaultFps: number;
  maxFrames: number;
  defaultFrames: number;
  supportsNegativePrompt: boolean;
  supportsGuidanceScale: boolean;
  supportsSeed: boolean;
  supportsImageToVideo: boolean;
  estimatedLatencyMs: number;    // p50 — video generation is slow (60–300s)
}

export interface VideoGenerationAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly tier: 'primary' | 'fallback' | 'research';
  readonly constraints: VideoModelConstraints;
  isConfigured(): boolean;
  generate(input: VideoGenerationInput): Promise<VideoAsset>;
  healthCheck(): Promise<CreativeProviderHealth>;
}
