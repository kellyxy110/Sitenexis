// Qwen Image adapters — Qwen/Qwen-Image and Qwen/Qwen-Image-2512
// Qwen multimodal image generation models from Alibaba.
// Both variants on the same adapter base; 2512 supports higher resolution.

import { HuggingFaceImageBase } from './huggingface.base';
import type { ImageModelConstraints, ImageGenerationInput, ImageGenerationAdapter } from './interface';

// ── Qwen-Image (standard) ─────────────────────────────────────────────────────

const QWEN_CONSTRAINTS: ImageModelConstraints = {
  minWidth: 256,
  maxWidth: 1024,
  minHeight: 256,
  maxHeight: 1024,
  defaultWidth: 1024,
  defaultHeight: 1024,
  maxSteps: 50,
  defaultSteps: 30,
  supportsNegativePrompt: true,
  supportsGuidanceScale: true,
  supportsSeed: true,
  maxBatchSize: 1,
  estimatedLatencyMs: 25_000,
};

export class QwenImageAdapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'qwen-image';
  readonly modelId = 'Qwen/Qwen-Image';
  readonly tier = 'primary' as const;
  readonly constraints = QWEN_CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: input.guidanceScale ?? 7.5,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

// ── Qwen-Image-2512 (high-res) ────────────────────────────────────────────────

const QWEN_2512_CONSTRAINTS: ImageModelConstraints = {
  ...QWEN_CONSTRAINTS,
  maxWidth: 2512,
  maxHeight: 2512,
  defaultWidth: 1024,
  defaultHeight: 1024,
  estimatedLatencyMs: 45_000,
};

export class QwenImage2512Adapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'qwen-image-2512';
  readonly modelId = 'Qwen/Qwen-Image-2512';
  readonly tier = 'primary' as const;
  readonly constraints = QWEN_2512_CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: ImageGenerationInput,
    width: number,
    height: number,
    steps: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: input.guidanceScale ?? 7.5,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

// ── Singletons ────────────────────────────────────────────────────────────────

let _standard: QwenImageAdapter | undefined;
let _highRes: QwenImage2512Adapter | undefined;

export function getQwenImageAdapter(hfToken?: string): QwenImageAdapter {
  if (!_standard || hfToken) _standard = new QwenImageAdapter(hfToken);
  return _standard;
}

export function getQwenImage2512Adapter(hfToken?: string): QwenImage2512Adapter {
  if (!_highRes || hfToken) _highRes = new QwenImage2512Adapter(hfToken);
  return _highRes;
}
