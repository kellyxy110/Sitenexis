// QwenImageEditAdapter — Phr00t/Qwen-Image-Edit-Rapid-AIO
// Instruction-based image editing via HuggingFace Inference API.
// Rapid AIO variant: optimized for fast edits with a single unified model.

import { randomUUID } from 'crypto';
import type { ImageAsset, ImageMimeType, CreativeProviderHealth } from '../types';
import type { ImageEditingAdapter, ImageEditingInput, ImageEditingConstraints } from './interface';
import { validatePrompt, isTokenConfigured } from '../security';

const HF_BASE_URL = 'https://api-inference.huggingface.co/models';
const MODEL_ID = 'Phr00t/Qwen-Image-Edit-Rapid-AIO';
const DEFAULT_TIMEOUT_MS = 60_000;

const CONSTRAINTS: ImageEditingConstraints = {
  maxInputWidthPx: 1024,
  maxInputHeightPx: 1024,
  supportsInpainting: true,
  supportsGlobalInstruction: true,
  maxInstructionLength: 500,
  estimatedLatencyMs: 20_000,
};

export class QwenImageEditAdapter implements ImageEditingAdapter {
  readonly provider = 'qwen-image-edit';
  readonly modelId = MODEL_ID;
  readonly tier = 'primary' as const;
  readonly constraints = CONSTRAINTS;

  private readonly hfToken: string;

  constructor(hfToken?: string) {
    this.hfToken = hfToken ?? process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_TOKEN'] ?? '';
  }

  isConfigured(): boolean {
    return isTokenConfigured(this.hfToken);
  }

  async edit(input: ImageEditingInput): Promise<ImageAsset> {
    const instruction = validatePrompt(input.instruction, 'instruction');
    if (input.negativeInstruction !== undefined) validatePrompt(input.negativeInstruction, 'negativeInstruction');
    if (instruction.length > CONSTRAINTS.maxInstructionLength) {
      throw new Error(`Instruction exceeds ${CONSTRAINTS.maxInstructionLength} characters`);
    }

    const timeoutMs = input.ctx?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const imageBase64 = input.imageBuffer.toString('base64');

    const body: Record<string, unknown> = {
      inputs: instruction,
      parameters: {
        image: imageBase64,
        strength: input.strength ?? 0.8,
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
        ...(input.negativeInstruction ? { negative_prompt: input.negativeInstruction } : {}),
        ...(input.maskBuffer ? { mask: input.maskBuffer.toString('base64') } : {}),
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    let res: Response;
    try {
      res = await fetch(`${HF_BASE_URL}/${MODEL_ID}`, {
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
      throw new Error(`QwenImageEdit ${MODEL_ID} returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    const mimeType: ImageMimeType = ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : 'image/jpeg';
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);

    if (buffer.length < 100) {
      throw new Error(`QwenImageEdit returned suspiciously small response (${buffer.length} bytes)`);
    }

    const latencyMs = Date.now() - start;

    const asset: ImageAsset = {
      id: randomUUID(),
      buffer,
      mimeType: input.outputFormat === 'png' ? 'image/png' : input.outputFormat === 'webp' ? 'image/webp' : mimeType,
      width: 0,       // HF image editing API doesn't return dimensions in headers
      height: 0,
      prompt: instruction,
      model: MODEL_ID,
      provider: 'qwen-image-edit',
      latencyMs,
      generatedAt: new Date(),
    };

    if (input.seed !== undefined) asset.seed = input.seed;

    return asset;
  }

  async healthCheck(): Promise<CreativeProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: 'qwen-image-edit', model: MODEL_ID, status: 'unavailable', latencyMs: 0, checkedAt: new Date(), details: 'HF_TOKEN not configured' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`https://api-inference.huggingface.co/status/${MODEL_ID}`, {
        headers: { 'Authorization': `Bearer ${this.hfToken}` },
        signal: AbortSignal.timeout(8_000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const json = await res.json() as { state?: string; loaded?: boolean };
        const state = json.state ?? '';
        const status = state === 'Loadable' || json.loaded ? 'healthy' : state === 'TooBig' ? 'unavailable' : 'degraded';
        return { provider: 'qwen-image-edit', model: MODEL_ID, status, latencyMs, checkedAt: new Date(), ...(state ? { details: state } : {}) };
      }
      return { provider: 'qwen-image-edit', model: MODEL_ID, status: 'degraded', latencyMs, checkedAt: new Date(), details: `status ${res.status}` };
    } catch (err) {
      return { provider: 'qwen-image-edit', model: MODEL_ID, status: 'unavailable', latencyMs: Date.now() - start, checkedAt: new Date(), details: err instanceof Error ? err.message : String(err) };
    }
  }
}

let _instance: QwenImageEditAdapter | undefined;

export function getQwenImageEditAdapter(hfToken?: string): QwenImageEditAdapter {
  if (!_instance || hfToken) _instance = new QwenImageEditAdapter(hfToken);
  return _instance;
}
