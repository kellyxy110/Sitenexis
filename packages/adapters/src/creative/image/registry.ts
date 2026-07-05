// ImageGenerationRegistry — ordered adapter chain for image generation.
// Business logic calls imageRegistry.generate() and never deals with provider selection.

import type { ImageGenerationAdapter, ImageGenerationInput } from './interface';
import type { ImageAsset, CreativeCallMetrics } from '../types';
import { getFluxSchnellAdapter } from './flux-schnell.adapter';

export class ImageGenerationError extends Error {
  readonly provider: string;
  constructor(message: string, provider = 'unknown') {
    super(message);
    this.name = 'ImageGenerationError';
    this.provider = provider;
  }
}

type Tier = 'primary' | 'fallback' | 'research';

interface RegistryEntry {
  name: string;
  tier: Tier;
  adapter: ImageGenerationAdapter;
}

const TIER_ORDER: Record<Tier, number> = { primary: 0, fallback: 1, research: 2 };

export class ImageGenerationRegistry {
  private entries: RegistryEntry[] = [];
  private metricsHandlers: Array<(m: CreativeCallMetrics) => void> = [];

  register(name: string, tier: Tier, adapter: ImageGenerationAdapter): void {
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

  get(name: string): ImageGenerationAdapter | undefined {
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

  /**
   * Generate with automatic fallback across tiers.
   * If the registry is empty, falls back to FLUX.1-schnell directly.
   */
  async generate(input: ImageGenerationInput): Promise<ImageAsset> {
    const configured = this.entries.filter((e) => e.adapter.isConfigured());

    if (configured.length === 0) {
      return this.schnellLastResort(input);
    }

    let lastErr: unknown;

    for (const entry of configured) {
      const start = Date.now();
      try {
        const asset = await entry.adapter.generate(input);
        this.emit({
          provider: entry.adapter.provider,
          model: entry.adapter.modelId,
          capability: 'image',
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
          capability: 'image',
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

    throw lastErr ?? new ImageGenerationError('All image generation providers failed');
  }

  private async schnellLastResort(input: ImageGenerationInput): Promise<ImageAsset> {
    const adapter = getFluxSchnellAdapter();
    if (!adapter.isConfigured()) {
      throw new ImageGenerationError('No image generation provider configured — set HF_TOKEN or register a provider');
    }
    return adapter.generate(input);
  }
}

export const imageRegistry = new ImageGenerationRegistry();
