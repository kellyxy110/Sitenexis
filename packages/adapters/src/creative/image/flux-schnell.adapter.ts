// FLUX.1-schnell adapter — black-forest-labs/FLUX.1-schnell
// Fast, 4-step distilled FLUX variant. Best for real-time generation.
// Primary tier: low latency (4–8s), free inference tier eligible.

import { HuggingFaceImageBase } from './huggingface.base';
import type { ImageModelConstraints } from './interface';
import type { ImageGenerationInput } from './interface';

const CONSTRAINTS: ImageModelConstraints = {
  minWidth: 256,
  maxWidth: 1440,
  minHeight: 256,
  maxHeight: 1440,
  defaultWidth: 1024,
  defaultHeight: 1024,
  maxSteps: 8,              // schnell is distilled — more steps don't improve quality
  defaultSteps: 4,
  supportsNegativePrompt: false,   // FLUX models don't use negative prompts
  supportsGuidanceScale: false,
  supportsSeed: true,
  maxBatchSize: 1,
  supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  estimatedLatencyMs: 6_000,
};

export class FluxSchnellAdapter extends HuggingFaceImageBase {
  readonly provider = 'flux-schnell';
  readonly modelId = 'black-forest-labs/FLUX.1-schnell';
  readonly tier = 'primary' as const;
  readonly constraints = CONSTRAINTS;

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
    };
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

let _instance: FluxSchnellAdapter | undefined;

export function getFluxSchnellAdapter(hfToken?: string): FluxSchnellAdapter {
  if (!_instance || hfToken) _instance = new FluxSchnellAdapter(hfToken);
  return _instance;
}
