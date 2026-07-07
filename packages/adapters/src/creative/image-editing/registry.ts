// ImageEditingRegistry — adapter chain for instruction-based image editing.

import type { ImageEditingAdapter, ImageEditingInput } from './interface';
import type { ImageAsset, CreativeCallMetrics } from '../types';
import { getQwenImageEditAdapter } from './qwen-image-edit.adapter';

export class ImageEditingError extends Error {
  readonly provider: string;
  constructor(message: string, provider = 'unknown') {
    super(message);
    this.name = 'ImageEditingError';
    this.provider = provider;
  }
}

type Tier = 'primary' | 'fallback' | 'research';

interface RegistryEntry {
  name: string;
  tier: Tier;
  adapter: ImageEditingAdapter;
}

const TIER_ORDER: Record<Tier, number> = { primary: 0, fallback: 1, research: 2 };

export class ImageEditingRegistry {
  private entries: RegistryEntry[] = [];
  private metricsHandlers: Array<(m: CreativeCallMetrics) => void> = [];

  register(name: string, tier: Tier, adapter: ImageEditingAdapter): void {
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

  get(name: string): ImageEditingAdapter | undefined {
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
   * Edit with automatic fallback across tiers.
   * If the registry is empty, falls back to QwenImageEdit directly.
   */
  async edit(input: ImageEditingInput): Promise<ImageAsset> {
    const configured = this.entries.filter((e) => e.adapter.isConfigured());

    if (configured.length === 0) {
      return this.qwenLastResort(input);
    }

    let lastErr: unknown;
    for (const entry of configured) {
      const start = Date.now();
      try {
        const asset = await entry.adapter.edit(input);
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

    throw lastErr ?? new ImageEditingError('All image editing providers failed');
  }

  private async qwenLastResort(input: ImageEditingInput): Promise<ImageAsset> {
    const adapter = getQwenImageEditAdapter();
    if (!adapter.isConfigured()) {
      throw new ImageEditingError('No image editing provider configured — set HF_TOKEN or register a provider');
    }
    return adapter.edit(input);
  }
}

export const imageEditingRegistry = new ImageEditingRegistry();
