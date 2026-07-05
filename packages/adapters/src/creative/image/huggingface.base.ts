// HuggingFaceImageBase — shared HTTP logic for all HuggingFace image adapters.
// All providers on HuggingFace Inference API use the same endpoint shape.
// Provider adapters extend this class and only override model-specific config.

import { randomUUID } from 'crypto';
import type { ImageAsset, ImageMimeType, CreativeProviderHealth } from '../types';
import type { ImageGenerationInput, ImageModelConstraints } from './interface';
import { validatePrompt, isTokenConfigured } from '../security';

const HF_BASE_URL = 'https://api-inference.huggingface.co/models';
const DEFAULT_TIMEOUT_MS = 90_000;   // image generation can take 30–80s on cold start

// ── Response helpers ──────────────────────────────────────────────────────────

async function bufferFromResponse(res: Response): Promise<{ buffer: Buffer; mimeType: ImageMimeType }> {
  const ct = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType: ImageMimeType = ct.includes('png') ? 'image/png'
    : ct.includes('webp') ? 'image/webp'
    : 'image/jpeg';
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), mimeType };
}

function parseDimensions(buffer: Buffer, fallbackW: number, fallbackH: number): { width: number; height: number } {
  // PNG: signature + IHDR chunk at bytes 16-24
  if (buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    try {
      const w = buffer.readUInt32BE(16);
      const h = buffer.readUInt32BE(20);
      if (w > 0 && h > 0) return { width: w, height: h };
    } catch { /* fall through */ }
  }
  // JPEG: don't parse, use fallback
  return { width: fallbackW, height: fallbackH };
}

// ── Base class ────────────────────────────────────────────────────────────────

export abstract class HuggingFaceImageBase {
  abstract readonly provider: string;
  abstract readonly modelId: string;
  abstract readonly tier: 'primary' | 'fallback' | 'research';
  abstract readonly constraints: ImageModelConstraints;

  protected readonly hfToken: string;

  constructor(hfToken?: string) {
    this.hfToken = hfToken ?? process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_TOKEN'] ?? '';
  }

  isConfigured(): boolean {
    return isTokenConfigured(this.hfToken);
  }

  async generate(input: ImageGenerationInput): Promise<ImageAsset> {
    const prompt = validatePrompt(input.prompt);
    if (input.negativePrompt !== undefined) validatePrompt(input.negativePrompt, 'negativePrompt');

    const timeoutMs = input.ctx?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const width = this.clamp(input.width ?? this.constraints.defaultWidth, this.constraints.minWidth, this.constraints.maxWidth);
    const height = this.clamp(input.height ?? this.constraints.defaultHeight, this.constraints.minHeight, this.constraints.maxHeight);
    const steps = this.clamp(input.steps ?? this.constraints.defaultSteps, 1, this.constraints.maxSteps);

    const body = this.buildRequestBody(prompt, input, width, height, steps);
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
          'x-wait-for-model': 'true',          // wait on cold start instead of 503
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

    const { buffer, mimeType } = await bufferFromResponse(res);
    if (buffer.length < 100) {
      throw new Error(`HuggingFace ${this.modelId} returned suspiciously small response (${buffer.length} bytes)`);
    }

    const dims = parseDimensions(buffer, width, height);
    const latencyMs = Date.now() - start;

    const asset: ImageAsset = {
      id: randomUUID(),
      buffer,
      mimeType: (input.outputFormat === 'png' ? 'image/png'
        : input.outputFormat === 'webp' ? 'image/webp'
        : mimeType),
      width: dims.width,
      height: dims.height,
      prompt,
      model: this.modelId,
      provider: this.provider,
      latencyMs,
      generatedAt: new Date(),
    };

    if (input.negativePrompt !== undefined) asset.negativePrompt = input.negativePrompt;
    if (input.seed !== undefined) asset.seed = input.seed;
    if (input.steps !== undefined) asset.steps = steps;
    if (input.guidanceScale !== undefined && this.constraints.supportsGuidanceScale) {
      asset.guidanceScale = input.guidanceScale;
    }
    if (input.aspectRatio !== undefined) asset.aspectRatio = input.aspectRatio;

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
        const json = await res.json() as { state?: string; compute_type?: string; loaded?: boolean };
        const state = json.state ?? '';
        const status = state === 'Loadable' || json.loaded ? 'healthy'
          : state === 'TooBig' ? 'unavailable'
          : 'degraded';
        return { provider: this.provider, model: this.modelId, status, latencyMs, checkedAt: new Date(), ...(state ? { details: state } : {}) };
      }
      return { provider: this.provider, model: this.modelId, status: 'degraded', latencyMs, checkedAt: new Date(), details: `status ${res.status}` };
    } catch (err) {
      return { provider: this.provider, model: this.modelId, status: 'unavailable', latencyMs: Date.now() - start, checkedAt: new Date(), details: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  protected clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  /** Override to customize the HuggingFace request body for this model */
  protected buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = { width, height, num_inference_steps: steps };
    if (input.negativePrompt !== undefined && this.constraints.supportsNegativePrompt) {
      params['negative_prompt'] = input.negativePrompt;
    }
    if (input.guidanceScale !== undefined && this.constraints.supportsGuidanceScale) {
      params['guidance_scale'] = input.guidanceScale;
    }
    if (input.seed !== undefined && this.constraints.supportsSeed) {
      params['seed'] = input.seed;
    }
    return { inputs: prompt, parameters: params };
  }
}
