// Wan14B adapter — vrgamedevgirl84/Wan14BT2VFusioniX
// Wan 14B text-to-video fusion model. Research tier — high quality, very slow.
// ~180–300s generation time; not suitable for real-time use.

import { HuggingFaceVideoBase } from './huggingface.base';
import type { VideoModelConstraints, VideoGenerationInput, VideoGenerationAdapter } from './interface';

const CONSTRAINTS: VideoModelConstraints = {
  minWidth: 480,
  maxWidth: 1280,
  minHeight: 480,
  maxHeight: 720,
  defaultWidth: 832,
  defaultHeight: 480,
  defaultFps: 16,
  maxFrames: 81,
  defaultFrames: 81,            // ~5s at 16fps
  supportsNegativePrompt: true,
  supportsGuidanceScale: true,
  supportsSeed: true,
  supportsImageToVideo: false,
  estimatedLatencyMs: 240_000,
};

export class Wan14BAdapter extends HuggingFaceVideoBase implements VideoGenerationAdapter {
  readonly provider = 'wan-14b';
  readonly modelId = 'vrgamedevgirl84/Wan14BT2VFusioniX';
  readonly tier = 'research' as const;
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
      guidance_scale: input.guidanceScale ?? 5.0,
    };
    if (input.negativePrompt) params['negative_prompt'] = input.negativePrompt;
    if (input.seed !== undefined) params['seed'] = input.seed;
    return { inputs: prompt, parameters: params };
  }
}

let _instance: Wan14BAdapter | undefined;

export function getWan14BAdapter(hfToken?: string): Wan14BAdapter {
  if (!_instance || hfToken) _instance = new Wan14BAdapter(hfToken);
  return _instance;
}
