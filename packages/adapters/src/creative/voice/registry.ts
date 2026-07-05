// VoiceGenerationRegistry — ordered adapter chain for TTS generation.

import type { VoiceGenerationAdapter, VoiceGenerationInput } from './interface';
import type { VoiceAsset, CreativeCallMetrics } from '../types';

export class VoiceGenerationError extends Error {
  readonly provider: string;
  constructor(message: string, provider = 'unknown') {
    super(message);
    this.name = 'VoiceGenerationError';
    this.provider = provider;
  }
}

type Tier = 'primary' | 'fallback' | 'stub';
const TIER_ORDER: Record<Tier, number> = { primary: 0, fallback: 1, stub: 2 };

interface RegistryEntry { name: string; tier: Tier; adapter: VoiceGenerationAdapter; }

export class VoiceGenerationRegistry {
  private entries: RegistryEntry[] = [];
  private metricsHandlers: Array<(m: CreativeCallMetrics) => void> = [];

  register(name: string, tier: Tier, adapter: VoiceGenerationAdapter): void {
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

  get(name: string): VoiceGenerationAdapter | undefined {
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

  async generate(input: VoiceGenerationInput): Promise<VoiceAsset> {
    const configured = this.entries.filter((e) => e.adapter.isConfigured());

    if (configured.length === 0) {
      throw new VoiceGenerationError('No voice generation provider configured — set KOKORO_ENDPOINT_URL or register a provider');
    }

    let lastErr: unknown;

    for (const entry of configured) {
      const start = Date.now();
      try {
        const asset = await entry.adapter.generate(input);
        this.emit({
          provider: entry.adapter.provider,
          model: entry.adapter.modelId,
          capability: 'voice',
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
          capability: 'voice',
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

    throw lastErr ?? new VoiceGenerationError('All voice generation providers failed');
  }
}

export const voiceRegistry = new VoiceGenerationRegistry();
