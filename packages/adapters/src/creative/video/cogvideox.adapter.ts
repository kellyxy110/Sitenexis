// CogVideoX-5b adapter — zai-org/CogVideoX-5b
// 5B parameter text-to-video model. Primary video generation provider.
// Supports text-to-video and image-to-video. ~90s generation time.

import { HuggingFaceVideoBase } from './huggingface.base';
import type { VideoModelConstraints, VideoGenerationInput, VideoGenerationAdapter } from './interface';

const CONSTRAINTS: VideoModelConstraints = {
  minWidth: 480,
  maxWidth: 720,
  minHeight: 480,
  maxHeight: 480,
  defaultWidth: 720,
  defaultHeight: 480,
  defaultFps: 8,
  maxFrames: 49,
  defaultFrames: 49,             // ~6s at 8fps
  supportsNegativePrompt: false,
  supportsGuidanceScale: true,
  supportsSeed: true,
  supportsImageToVideo: true,
  estimatedLatencyMs: 90_000,
};

export class CogVideoX5bAdapter extends HuggingFaceVideoBase implements VideoGenerationAdapter {
  readonly provider = 'cogvideox-5b';
  readonly modelId = 'zai-org/CogVideoX-5b';
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
      guidance_scale: input.guidanceScale ?? 6.0,
      use_dynamic_cfg: true,
    };
    if (input.seed !== undefined) params['seed'] = input.seed;

    // Image-to-video: pass image as base64 in parameters
    if (input.imageBuffer !== undefined) {
      params['image'] = input.imageBuffer.toString('base64');
    } else if (input.imageUrl !== undefined) {
      params['image_url'] = input.imageUrl;
    }

    return { inputs: prompt, parameters: params };
  }
}

let _instance: CogVideoX5bAdapter | undefined;

export function getCogVideoX5bAdapter(hfToken?: string): CogVideoX5bAdapter {
  if (!_instance || hfToken) _instance = new CogVideoX5bAdapter(hfToken);
  return _instance;
}
