// LTX-2.3 adapter — Lightricks/LTX-2.3
// Fast, high-quality text-to-video and image-to-video model by Lightricks.
// Primary tier: 5–25s generation, 2–9s clips at up to 768×512.

import { HuggingFaceVideoBase } from './huggingface.base';
import type { VideoModelConstraints, VideoGenerationInput, VideoGenerationAdapter } from './interface';

const CONSTRAINTS: VideoModelConstraints = {
  minWidth: 256,
  maxWidth: 768,
  minHeight: 256,
  maxHeight: 512,
  defaultWidth: 768,
  defaultHeight: 512,
  defaultFps: 24,
  maxFrames: 257,               // ~9s at 24fps — LTX-2.3 architectural limit
  defaultFrames: 121,           // ~5s at 24fps — balanced quality/speed
  supportsNegativePrompt: true,
  supportsGuidanceScale: true,
  supportsSeed: true,
  supportsImageToVideo: true,
  estimatedLatencyMs: 20_000,
};

export class Ltx23Adapter extends HuggingFaceVideoBase implements VideoGenerationAdapter {
  readonly provider = 'ltx-23';
  readonly modelId = 'Lightricks/LTX-2.3';
  readonly tier = 'primary' as const;
  readonly constraints = CONSTRAINTS;

  protected override buildRequestBody(
    prompt: string,
    input: VideoGenerationInput,
    width: number,
    height: number,
    numFrames: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      width,
      height,
      num_frames: numFrames,
      guidance_scale: input.guidanceScale ?? 3.0,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    if (input.imageBuffer !== undefined) params['image'] = input.imageBuffer.toString('base64');
    else if (input.imageUrl !== undefined) params['image_url'] = input.imageUrl;
    return { inputs: prompt, parameters: params };
  }
}

let _instance: Ltx23Adapter | undefined;

export function getLtx23Adapter(hfToken?: string): Ltx23Adapter {
  if (!_instance || hfToken) _instance = new Ltx23Adapter(hfToken);
  return _instance;
}
