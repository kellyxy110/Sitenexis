// HuggingFaceVideoBase — shared HTTP logic for HuggingFace video generation.
// Video models return binary video data (mp4/webm) via the Inference API.

import { randomUUID } from 'crypto';
import type { VideoAsset, VideoMimeType, CreativeProviderHealth } from '../types';
import type { VideoGenerationInput, VideoModelConstraints } from './interface';
import { validatePrompt, isTokenConfigured } from '../security';

const HF_BASE_URL = 'https://api-inference.huggingface.co/models';
const DEFAULT_TIMEOUT_MS = 300_000;   // video generation is slow: 60–300s

export abstract class HuggingFaceVideoBase {
  abstract readonly provider: string;
  abstract readonly modelId: string;
  abstract readonly tier: 'primary' | 'fallback' | 'research';
  abstract readonly constraints: VideoModelConstraints;

  protected readonly hfToken: string;

  constructor(hfToken?: string) {
    this.hfToken = hfToken ?? process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_TOKEN'] ?? '';
  }

  isConfigured(): boolean {
    return isTokenConfigured(this.hfToken);
  }

  async generate(input: VideoGenerationInput): Promise<VideoAsset> {
    const prompt = validatePrompt(input.prompt);
    if (input.negativePrompt !== undefined) validatePrompt(input.negativePrompt, 'negativePrompt');

    const timeoutMs = input.ctx?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const width = this.clamp(input.width ?? this.constraints.defaultWidth, this.constraints.minWidth, this.constraints.maxWidth);
    const height = this.clamp(input.height ?? this.constraints.defaultHeight, this.constraints.minHeight, this.constraints.maxHeight);
    const numFrames = this.clamp(
      input.numFrames ?? (input.durationSeconds !== undefined
        ? Math.round(input.durationSeconds * (input.fps ?? this.constraints.defaultFps))
        : this.constraints.defaultFrames),
      1,
      this.constraints.maxFrames,
    );

    const body = this.buildRequestBody(prompt, input, width, height, numFrames);
    const start = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${HF_BASE_URL}/${this.modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HuggingFace ${this.modelId} returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const ct = res.headers.get('content-type') ?? 'video/mp4';
    const mimeType: VideoMimeType = ct.includes('webm') ? 'video/webm' : 'video/mp4';
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);

    if (buffer.length < 1000) {
      throw new Error(`HuggingFace ${this.modelId} returned suspiciously small video (${buffer.length} bytes)`);
    }

    const fps = input.fps ?? this.constraints.defaultFps;
    const durationMs = Math.round((numFrames / fps) * 1000);
    const latencyMs = Date.now() - start;

    const asset: VideoAsset = {
      id: randomUUID(),
      buffer,
      mimeType,
      durationMs,
      fps,
      width,
      height,
      prompt,
      model: this.modelId,
      provider: this.provider,
      latencyMs,
      generatedAt: new Date(),
    };

    if (input.negativePrompt !== undefined) asset.imagePrompt = input.negativePrompt;
    if (input.seed !== undefined) asset.seed = input.seed;

    return asset;
  }

  async healthCheck(): Promise<CreativeProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: this.provider, model: this.modelId, status: 'unavailable', latencyMs: 0, checkedAt: new Date(), details: 'HF_TOKEN not configured' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`https://api-inference.huggingface.co/status/${this.modelId}`, {
        headers: { 'Authorization': `Bearer ${this.hfToken}` },
        signal: AbortSignal.timeout(8_000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const json = await res.json() as { state?: string; loaded?: boolean };
        const state = json.state ?? '';
        const status = state === 'Loadable' || json.loaded ? 'healthy' : state === 'TooBig' ? 'unavailable' : 'degraded';
        return { provider: this.provider, model: this.modelId, status, latencyMs, checkedAt: new Date(), ...(state ? { details: state } : {}) };
      }
      return { provider: this.provider, model: this.modelId, status: 'degraded', latencyMs, checkedAt: new Date(), details: `status ${res.status}` };
    } catch (err) {
      return { provider: this.provider, model: this.modelId, status: 'unavailable', latencyMs: Date.now() - start, checkedAt: new Date(), details: err instanceof Error ? err.message : String(err) };
    }
  }

  protected clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  protected buildRequestBody(
    prompt: string,
    input: VideoGenerationInput,
    width: number,
    height: number,
    numFrames: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = { width, height, num_frames: numFrames };
    if (input.guidanceScale !== undefined && this.constraints.supportsGuidanceScale) {
      params['guidance_scale'] = input.guidanceScale;
    }
    if (input.negativePrompt !== undefined && this.constraints.supportsNegativePrompt) {
      params['negative_prompt'] = input.negativePrompt;
    }
    if (input.seed !== undefined && this.constraints.supportsSeed) {
      params['seed'] = input.seed;
    }
    return { inputs: prompt, parameters: params };
  }
}
