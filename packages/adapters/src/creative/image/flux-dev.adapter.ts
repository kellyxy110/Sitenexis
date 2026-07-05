// FLUX.1-dev adapter — black-forest-labs/FLUX.1-dev
// Full-quality FLUX guidance-distilled model. Best output quality, higher latency.
// Primary tier: 20–50s, requires HF Pro for reliable throughput.

import { HuggingFaceImageBase } from './huggingface.base';
import type { ImageModelConstraints, ImageGenerationInput } from './interface';

const CONSTRAINTS: ImageModelConstraints = {
  minWidth: 256,
  maxWidth: 1440,
  minHeight: 256,
  maxHeight: 1440,
  defaultWidth: 1024,
  defaultHeight: 1024,
  maxSteps: 50,
  defaultSteps: 28,
  supportsNegativePrompt: false,
  supportsGuidanceScale: true,
  supportsSeed: true,
  maxBatchSize: 1,
  supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  estimatedLatencyMs: 35_000,
};

export class FluxDevAdapter extends HuggingFaceImageBase {
  readonly provider = 'flux-dev';
  readonly modelId = 'black-forest-labs/FLUX.1-dev';
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
      guidance_scale: input.guidanceScale ?? 3.5,
    };
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

let _instance: FluxDevAdapter | undefined;

export function getFluxDevAdapter(hfToken?: string): FluxDevAdapter {
  if (!_instance || hfToken) _instance = new FluxDevAdapter(hfToken);
  return _instance;
}
