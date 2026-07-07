// ImageEditingCapability — canonical interface for instruction-based image editing.
// Adapters take an existing image + edit instruction and return a modified image.
// Callers never import provider SDKs directly.

import type { ImageAsset, CreativeContext, CreativeProviderHealth } from '../types';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface ImageEditingInput {
  /** Source image as raw bytes */
  imageBuffer: Buffer;
  /** Natural-language instruction: "remove the background", "make it night-time", etc. */
  instruction: string;
  /** Optional mask — areas to edit (white = edit, black = preserve) */
  maskBuffer?: Buffer;
  /** Optional negative instruction to guide away from */
  negativeInstruction?: string;
  /** 0–1: how strongly to follow the instruction vs. preserve the original */
  strength?: number;
  seed?: number;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  ctx?: CreativeContext;
}

// ── Constraints ───────────────────────────────────────────────────────────────

export interface ImageEditingConstraints {
  maxInputWidthPx: number;
  maxInputHeightPx: number;
  supportsInpainting: boolean;     // mask-guided editing
  supportsGlobalInstruction: boolean;
  maxInstructionLength: number;    // characters
  estimatedLatencyMs: number;      // p50
}

// ── Adapter contract ──────────────────────────────────────────────────────────

export interface ImageEditingAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly tier: 'primary' | 'fallback' | 'research';
  readonly constraints: ImageEditingConstraints;
  isConfigured(): boolean;
  edit(input: ImageEditingInput): Promise<ImageAsset>;
  healthCheck(): Promise<CreativeProviderHealth>;
}
