// Creative Benchmark Framework — provider comparison and performance tracking.
// Run benchmarks to compare image/video generation quality and latency across providers.

import type { ImageAsset, VideoAsset, CreativeProviderHealth } from './types';
import type { ImageGenerationAdapter, ImageGenerationInput } from './image/interface';
import type { VideoGenerationAdapter, VideoGenerationInput } from './video/interface';

// ── Benchmark result types ────────────────────────────────────────────────────

export interface ImageBenchmarkResult {
  provider: string;
  modelId: string;
  prompt: string;
  success: boolean;
  latencyMs?: number;
  outputSizeBytes?: number;
  width?: number;
  height?: number;
  errorMessage?: string;
  asset?: ImageAsset;
  timestamp: Date;
}

export interface VideoBenchmarkResult {
  provider: string;
  modelId: string;
  prompt: string;
  success: boolean;
  latencyMs?: number;
  outputSizeBytes?: number;
  durationMs?: number;
  errorMessage?: string;
  asset?: VideoAsset;
  timestamp: Date;
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  prompts: string[];
  imageResults?: ImageBenchmarkResult[][];   // [promptIndex][adapterIndex]
  videoResults?: VideoBenchmarkResult[][];
  healthChecks?: CreativeProviderHealth[];
  ranAt: Date;
  durationMs: number;
  summary: BenchmarkSummary;
}

export interface BenchmarkSummary {
  imageAdapters: ProviderSummary[];
  videoAdapters: ProviderSummary[];
  recommendation: string;
}

export interface ProviderSummary {
  provider: string;
  modelId: string;
  successRate: number;        // 0–1
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgOutputKb: number;
  tier: 'primary' | 'fallback' | 'research' | 'stub';
}

// ── Benchmark runner ──────────────────────────────────────────────────────────

export class CreativeBenchmarkRunner {
  private imageAdapters: ImageGenerationAdapter[] = [];
  private videoAdapters: VideoGenerationAdapter[] = [];

  addImageAdapter(adapter: ImageGenerationAdapter): this {
    this.imageAdapters.push(adapter);
    return this;
  }

  addVideoAdapter(adapter: VideoGenerationAdapter): this {
    this.videoAdapters.push(adapter);
    return this;
  }

  async runImageBenchmark(
    prompts: string[],
    baseInput: Omit<ImageGenerationInput, 'prompt'> = {},
  ): Promise<ImageBenchmarkResult[][]> {
    const results: ImageBenchmarkResult[][] = [];
    for (const prompt of prompts) {
      const promptResults: ImageBenchmarkResult[] = [];
      for (const adapter of this.imageAdapters) {
        const result = await this.runSingleImage(adapter, prompt, baseInput);
        promptResults.push(result);
      }
      results.push(promptResults);
    }
    return results;
  }

  async runVideoBenchmark(
    prompts: string[],
    baseInput: Omit<VideoGenerationInput, 'prompt'> = {},
  ): Promise<VideoBenchmarkResult[][]> {
    const results: VideoBenchmarkResult[][] = [];
    for (const prompt of prompts) {
      const promptResults: VideoBenchmarkResult[] = [];
      for (const adapter of this.videoAdapters) {
        const result = await this.runSingleVideo(adapter, prompt, baseInput);
        promptResults.push(result);
      }
      results.push(promptResults);
    }
    return results;
  }

  async runHealthChecks(): Promise<CreativeProviderHealth[]> {
    const checks = await Promise.allSettled([
      ...this.imageAdapters.map((a) => a.healthCheck()),
      ...this.videoAdapters.map((a) => a.healthCheck()),
    ]);
    return checks
      .filter((r): r is PromiseFulfilledResult<CreativeProviderHealth> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  buildSummary(
    imageResults: ImageBenchmarkResult[][],
    videoResults: VideoBenchmarkResult[][],
  ): BenchmarkSummary {
    const imageSummaries = this.imageAdapters.map((adapter) => {
      const flat = imageResults.flatMap((r) => r.filter((x) => x.provider === adapter.provider));
      return buildProviderSummary(adapter.provider, adapter.modelId, adapter.tier, flat);
    });

    const videoSummaries = this.videoAdapters.map((adapter) => {
      const flat = videoResults.flatMap((r) => r.filter((x) => x.provider === adapter.provider));
      return buildProviderSummary(adapter.provider, adapter.modelId, adapter.tier, flat);
    });

    const bestImage = imageSummaries.sort((a, b) => b.successRate - a.successRate)[0];
    const recommendation = bestImage
      ? `Recommended image provider: ${bestImage.provider} (${(bestImage.successRate * 100).toFixed(0)}% success, avg ${bestImage.avgLatencyMs}ms)`
      : 'No image adapters benchmarked';

    return { imageAdapters: imageSummaries, videoAdapters: videoSummaries, recommendation };
  }

  private async runSingleImage(
    adapter: ImageGenerationAdapter,
    prompt: string,
    base: Omit<ImageGenerationInput, 'prompt'>,
  ): Promise<ImageBenchmarkResult> {
    const timestamp = new Date();
    try {
      const asset = await adapter.generate({ ...base, prompt });
      return { provider: adapter.provider, modelId: adapter.modelId, prompt, success: true, latencyMs: asset.latencyMs, outputSizeBytes: asset.buffer.length, width: asset.width, height: asset.height, asset, timestamp };
    } catch (err) {
      return { provider: adapter.provider, modelId: adapter.modelId, prompt, success: false, errorMessage: err instanceof Error ? err.message : String(err), timestamp };
    }
  }

  private async runSingleVideo(
    adapter: VideoGenerationAdapter,
    prompt: string,
    base: Omit<VideoGenerationInput, 'prompt'>,
  ): Promise<VideoBenchmarkResult> {
    const timestamp = new Date();
    try {
      const asset = await adapter.generate({ ...base, prompt });
      return { provider: adapter.provider, modelId: adapter.modelId, prompt, success: true, latencyMs: asset.latencyMs, outputSizeBytes: asset.buffer.length, durationMs: asset.durationMs, asset, timestamp };
    } catch (err) {
      return { provider: adapter.provider, modelId: adapter.modelId, prompt, success: false, errorMessage: err instanceof Error ? err.message : String(err), timestamp };
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProviderSummary(
  provider: string,
  modelId: string,
  tier: 'primary' | 'fallback' | 'research' | 'stub',
  results: Array<{ success: boolean; latencyMs?: number; outputSizeBytes?: number }>,
): ProviderSummary {
  if (results.length === 0) {
    return { provider, modelId, successRate: 0, avgLatencyMs: 0, p95LatencyMs: 0, avgOutputKb: 0, tier };
  }
  const successes = results.filter((r) => r.success);
  const latencies = successes.map((r) => r.latencyMs ?? 0).sort((a, b) => a - b);
  const sizes = successes.map((r) => (r.outputSizeBytes ?? 0) / 1024);
  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  return {
    provider,
    modelId,
    successRate: successes.length / results.length,
    avgLatencyMs: Math.round(avg(latencies)),
    p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1] ?? 0,
    avgOutputKb: Math.round(avg(sizes)),
    tier,
  };
}
