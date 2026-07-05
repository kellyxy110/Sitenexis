// VideoGenerationRegistry — ordered adapter chain for video generation.

import type { VideoGenerationAdapter, VideoGenerationInput } from './interface';
import type { VideoAsset, CreativeCallMetrics } from '../types';
import { getCogVideoX5bAdapter } from './cogvideox.adapter';

export class VideoGenerationError extends Error {
  readonly provider: string;
  constructor(message: string, provider = 'unknown') {
    super(message);
    this.name = 'VideoGenerationError';
    this.provider = provider;
  }
}

type Tier = 'primary' | 'fallback' | 'research';
const TIER_ORDER: Record<Tier, number> = { primary: 0, fallback: 1, research: 2 };

interface RegistryEntry { name: string; tier: Tier; adapter: VideoGenerationAdapter; }

export class VideoGenerationRegistry {
  private entries: RegistryEntry[] = [];
  private metricsHandlers: Array<(m: CreativeCallMetrics) => void> = [];

  register(name: string, tier: Tier, adapter: VideoGenerationAdapter): void {
    this.entries = this.entries.filter((e) => e.name !== name);
    this.entries.push({ name, tier, adapter });
    this.entries.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  }

  unregister(name: string): void {
    this.entries = this.entries.filter((e) => e.name !== name);
  }

  list(): string[] {
    return this.entries.map((e) => `${e.name}(${e.tier})`);
  }

  get(name: string): VideoGenerationAdapter | undefined {
    return this.entries.find((e) => e.name === name)?.adapter;
  }

  onMetrics(handler: (m: CreativeCallMetrics) => void): void {
    this.metricsHandlers.push(handler);
  }

  private emit(m: CreativeCallMetrics): void {
    for (const h of this.metricsHandlers) {
      try { h(m); } catch { /* metrics never throw */ }
    }
  }

  async generate(input: VideoGenerationInput): Promise<VideoAsset> {
    const configured = this.entries.filter((e) => e.adapter.isConfigured());

    if (configured.length === 0) {
      return this.cogvideoLastResort(input);
    }

    let lastErr: unknown;

    for (const entry of configured) {
      const start = Date.now();
      try {
        const asset = await entry.adapter.generate(input);
        this.emit({
          provider: entry.adapter.provider,
          model: entry.adapter.modelId,
          capability: 'video',
          latencyMs: asset.latencyMs,
          outputSizeBytes: asset.buffer.length,
          success: true,
          timestamp: new Date(),
          ...(input.ctx?.jobId !== undefined ? { jobId: input.ctx.jobId } : {}),
          ...(input.ctx?.traceId !== undefined ? { traceId: input.ctx.traceId } : {}),
        });
        return asset;
      } catch (err) {
        this.emit({
          provider: entry.adapter.provider,
          model: entry.adapter.modelId,
          capability: 'video',
          latencyMs: Date.now() - start,
          success: false,
          errorCode: err instanceof Error ? err.message.slice(0, 64) : 'unknown',
          timestamp: new Date(),
          ...(input.ctx?.jobId !== undefined ? { jobId: input.ctx.jobId } : {}),
          ...(input.ctx?.traceId !== undefined ? { traceId: input.ctx.traceId } : {}),
        });
        lastErr = err;
      }
    }

    throw lastErr ?? new VideoGenerationError('All video generation providers failed');
  }

  private async cogvideoLastResort(input: VideoGenerationInput): Promise<VideoAsset> {
    const adapter = getCogVideoX5bAdapter();
    if (!adapter.isConfigured()) {
      throw new VideoGenerationError('No video generation provider configured — set HF_TOKEN or register a provider');
    }
    return adapter.generate(input);
  }
}

export const videoRegistry = new VideoGenerationRegistry();
