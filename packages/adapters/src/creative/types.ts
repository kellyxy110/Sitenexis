// Creative Intelligence — canonical asset types.
// All capability interfaces and adapters produce these types.
// Business logic imports from here; never from provider SDKs.

// ── Context ───────────────────────────────────────────────────────────────────

export interface CreativeContext {
  jobId?: string;
  campaignId?: string;
  userId?: string;
  traceId?: string;
  timeoutMs?: number;   // hard deadline per call; defaults to 60 000 ms
  retries?: number;     // retry attempts on transient failure; defaults to 1
}

// ── Canonical asset types ─────────────────────────────────────────────────────

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type VideoMimeType = 'video/mp4' | 'video/webm';
export type AudioMimeType = 'audio/wav' | 'audio/mp3' | 'audio/opus';

export interface ImageAsset {
  id: string;
  buffer: Buffer;                  // raw bytes — caller encodes to data URI or uploads
  mimeType: ImageMimeType;
  width: number;
  height: number;
  prompt: string;
  negativePrompt?: string;
  model: string;
  provider: string;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  aspectRatio?: string;            // e.g. "16:9", "1:1", "4:3"
  generatedAt: Date;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface VideoAsset {
  id: string;
  buffer: Buffer;
  mimeType: VideoMimeType;
  durationMs: number;
  fps?: number;
  width?: number;
  height?: number;
  prompt: string;
  imagePrompt?: string;            // for image-to-video
  model: string;
  provider: string;
  seed?: number;
  generatedAt: Date;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface VoiceAsset {
  id: string;
  buffer: Buffer;
  mimeType: AudioMimeType;
  durationMs: number;
  sampleRate: number;
  text: string;
  voice: string;                   // voice ID / speaker ID
  model: string;
  provider: string;
  speed?: number;
  generatedAt: Date;
  latencyMs: number;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface CreativeCallMetrics {
  provider: string;
  model: string;
  capability: 'image' | 'video' | 'voice' | 'planning' | 'optimization';
  latencyMs: number;
  outputSizeBytes?: number;
  success: boolean;
  errorCode?: string;
  jobId?: string;
  traceId?: string;
  timestamp: Date;
  estimatedCostUsd?: number;
}

// ── Provider health ───────────────────────────────────────────────────────────

export interface CreativeProviderHealth {
  provider: string;
  model: string;
  status: 'healthy' | 'degraded' | 'unavailable' | 'loading';
  latencyMs: number;
  checkedAt: Date;
  details?: string;
  queueDepth?: number;            // HuggingFace queue position
}
