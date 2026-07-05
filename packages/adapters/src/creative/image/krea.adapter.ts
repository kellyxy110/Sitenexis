// Krea adapters — krea/Krea-2-Raw and krea/Krea-2-Turbo
// Krea AI photorealistic generation models.
// Raw = full quality, Turbo = faster distilled variant.

import { HuggingFaceImageBase } from './huggingface.base';
import type { ImageModelConstraints, ImageGenerationInput, ImageGenerationAdapter } from './interface';

// ── Shared constraints base ───────────────────────────────────────────────────

const KREA_BASE: Omit<ImageModelConstraints, 'defaultSteps' | 'maxSteps' | 'estimatedLatencyMs'> = {
  minWidth: 512,
  maxWidth: 1536,
  minHeight: 512,
  maxHeight: 1536,
  defaultWidth: 1024,
  defaultHeight: 1024,
  supportsNegativePrompt: true,
  supportsGuidanceScale: true,
  supportsSeed: true,
  maxBatchSize: 1,
  supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
};

// ── Krea-2-Raw ────────────────────────────────────────────────────────────────

const KREA_RAW_CONSTRAINTS: ImageModelConstraints = {
  ...KREA_BASE,
  maxSteps: 60,
  defaultSteps: 35,
  estimatedLatencyMs: 40_000,
};

export class KreaRawAdapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'krea-raw';
  readonly modelId = 'krea/Krea-2-Raw';
  readonly tier = 'primary' as const;
  readonly constraints = KREA_RAW_CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width, height, num_inference_steps: steps,
      guidance_scale: input.guidanceScale ?? 7.0,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

// ── Krea-2-Turbo ──────────────────────────────────────────────────────────────

const KREA_TURBO_CONSTRAINTS: ImageModelConstraints = {
  ...KREA_BASE,
  maxSteps: 12,
  defaultSteps: 8,
  estimatedLatencyMs: 10_000,
};

export class KreaTurboAdapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'krea-turbo';
  readonly modelId = 'krea/Krea-2-Turbo';
  readonly tier = 'primary' as const;
  readonly constraints = KREA_TURBO_CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width, height, num_inference_steps: steps,
      guidance_scale: input.guidanceScale ?? 5.0,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

// ── Singletons ────────────────────────────────────────────────────────────────

let _raw: KreaRawAdapter | undefined;
let _turbo: KreaTurboAdapter | undefined;

export function getKreaRawAdapter(hfToken?: string): KreaRawAdapter {
  if (!_raw || hfToken) _raw = new KreaRawAdapter(hfToken);
  return _raw;
}

export function getKreaTurboAdapter(hfToken?: string): KreaTurboAdapter {
  if (!_turbo || hfToken) _turbo = new KreaTurboAdapter(hfToken);
  return _turbo;
}
