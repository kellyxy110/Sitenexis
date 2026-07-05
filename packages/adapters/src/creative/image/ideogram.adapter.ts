// Ideogram 4 adapters — ideogram-ai/ideogram-4-fp8 and ideogram-ai/ideogram-4-nf4
// Ideogram's text-rendering-capable generation model.
// fp8 = full precision quantization; nf4 = 4-bit for lower memory use.

import { HuggingFaceImageBase } from './huggingface.base';
import type { ImageModelConstraints, ImageGenerationInput, ImageGenerationAdapter } from './interface';

const IDEOGRAM_BASE: Omit<ImageModelConstraints, 'defaultSteps' | 'maxSteps' | 'estimatedLatencyMs' | 'defaultWidth' | 'defaultHeight'> = {
  minWidth: 512,
  maxWidth: 1440,
  minHeight: 512,
  maxHeight: 1440,
  supportsNegativePrompt: true,
  supportsGuidanceScale: true,
  supportsSeed: true,
  maxBatchSize: 1,
  supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
};

// ── ideogram-4-fp8 (primary quality) ─────────────────────────────────────────

const FP8_CONSTRAINTS: ImageModelConstraints = {
  ...IDEOGRAM_BASE,
  defaultWidth: 1024,
  defaultHeight: 1024,
  maxSteps: 50,
  defaultSteps: 30,
  estimatedLatencyMs: 35_000,
};

export class Ideogram4Fp8Adapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'ideogram-fp8';
  readonly modelId = 'ideogram-ai/ideogram-4-fp8';
  readonly tier = 'primary' as const;
  readonly constraints = FP8_CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width, height, num_inference_steps: steps,
      guidance_scale: input.guidanceScale ?? 7.5,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

// ── ideogram-4-nf4 (memory-efficient) ────────────────────────────────────────

const NF4_CONSTRAINTS: ImageModelConstraints = {
  ...IDEOGRAM_BASE,
  defaultWidth: 1024,
  defaultHeight: 1024,
  maxSteps: 50,
  defaultSteps: 25,
  estimatedLatencyMs: 25_000,
};

export class Ideogram4Nf4Adapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'ideogram-nf4';
  readonly modelId = 'ideogram-ai/ideogram-4-nf4';
  readonly tier = 'fallback' as const;
  readonly constraints = NF4_CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width, height, num_inference_steps: steps,
      guidance_scale: input.guidanceScale ?? 7.5,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

// ── Singletons ────────────────────────────────────────────────────────────────

let _fp8: Ideogram4Fp8Adapter | undefined;
let _nf4: Ideogram4Nf4Adapter | undefined;

export function getIdeogram4Fp8Adapter(hfToken?: string): Ideogram4Fp8Adapter {
  if (!_fp8 || hfToken) _fp8 = new Ideogram4Fp8Adapter(hfToken);
  return _fp8;
}

export function getIdeogram4Nf4Adapter(hfToken?: string): Ideogram4Nf4Adapter {
  if (!_nf4 || hfToken) _nf4 = new Ideogram4Nf4Adapter(hfToken);
  return _nf4;
}
