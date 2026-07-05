// AssetOptimizationCapability — interface for post-generation asset processing.
// Handles format conversion, resizing, compression, and platform-specific delivery.

import type { ImageAsset, VideoAsset, CreativeContext } from '../types';

export interface ImageOptimizationInput {
  asset: ImageAsset;
  targetWidth?: number;
  targetHeight?: number;
  targetFormat?: 'jpeg' | 'png' | 'webp';
  quality?: number;               // 1–100; only meaningful for lossy formats
  maxFileSizeBytes?: number;      // auto-adjust quality to hit size target
  platform?: string;              // "instagram" | "facebook" | "twitter" | "youtube"
  ctx?: CreativeContext;
}

export interface VideoOptimizationInput {
  asset: VideoAsset;
  targetWidth?: number;
  targetHeight?: number;
  targetFormat?: 'mp4' | 'webm';
  maxFileSizeBytes?: number;
  trimStartMs?: number;
  trimEndMs?: number;
  ctx?: CreativeContext;
}

export interface OptimizedImageAsset extends ImageAsset {
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  compressionRatio: number;
  optimizationApplied: string[];  // list of operations applied
}

export interface OptimizedVideoAsset extends VideoAsset {
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  compressionRatio: number;
  optimizationApplied: string[];
}

// ── Platform delivery profiles ────────────────────────────────────────────────

export const PLATFORM_PROFILES: Record<string, { maxWidth: number; maxHeight: number; maxSizeBytes: number; format: 'jpeg' | 'png' | 'webp'; quality: number }> = {
  instagram_square:   { maxWidth: 1080, maxHeight: 1080, maxSizeBytes: 8_000_000,  format: 'jpeg', quality: 85 },
  instagram_portrait: { maxWidth: 1080, maxHeight: 1350, maxSizeBytes: 8_000_000,  format: 'jpeg', quality: 85 },
  instagram_story:    { maxWidth: 1080, maxHeight: 1920, maxSizeBytes: 8_000_000,  format: 'jpeg', quality: 85 },
  facebook_post:      { maxWidth: 1200, maxHeight: 630,  maxSizeBytes: 10_000_000, format: 'jpeg', quality: 85 },
  twitter_card:       { maxWidth: 1200, maxHeight: 675,  maxSizeBytes: 5_000_000,  format: 'jpeg', quality: 80 },
  youtube_thumbnail:  { maxWidth: 1280, maxHeight: 720,  maxSizeBytes: 2_000_000,  format: 'jpeg', quality: 90 },
};

export interface AssetOptimizationAdapter {
  readonly provider: string;
  isConfigured(): boolean;
  optimizeImage(input: ImageOptimizationInput): Promise<OptimizedImageAsset>;
  optimizeVideo(input: VideoOptimizationInput): Promise<OptimizedVideoAsset>;
}
