// CreativeCapabilityRegistry — top-level registry for all creative capabilities.
// Business logic accesses everything through this single registry.
// Pattern mirrors AIInferenceRegistry.

import { imageRegistry, ImageGenerationRegistry } from './image/registry';
import { videoRegistry, VideoGenerationRegistry } from './video/registry';
import { voiceRegistry, VoiceGenerationRegistry } from './voice/registry';
import type { ImageGenerationInput } from './image/interface';
import type { VideoGenerationInput } from './video/interface';
import type { VoiceGenerationInput } from './voice/interface';
import type { ImageAsset, VideoAsset, VoiceAsset, CreativeCallMetrics } from './types';

export class CreativeCapabilityRegistry {
  readonly image: ImageGenerationRegistry;
  readonly video: VideoGenerationRegistry;
  readonly voice: VoiceGenerationRegistry;

  constructor(
    img = imageRegistry,
    vid = videoRegistry,
    voc = voiceRegistry,
  ) {
    this.image = img;
    this.video = vid;
    this.voice = voc;
  }

  /** Subscribe to metrics across ALL capability types */
  onMetrics(handler: (m: CreativeCallMetrics) => void): void {
    this.image.onMetrics(handler);
    this.video.onMetrics(handler);
    this.voice.onMetrics(handler);
  }

  /** Convenience: generate image via the image registry */
  generateImage(input: ImageGenerationInput): Promise<ImageAsset> {
    return this.image.generate(input);
  }

  /** Convenience: generate video via the video registry */
  generateVideo(input: VideoGenerationInput): Promise<VideoAsset> {
    return this.video.generate(input);
  }

  /** Convenience: generate voice via the voice registry */
  generateVoice(input: VoiceGenerationInput): Promise<VoiceAsset> {
    return this.voice.generate(input);
  }

  /** Summary of all registered adapters across all capabilities */
  listAll(): Record<string, string[]> {
    return {
      image: this.image.list(),
      video: this.video.list(),
      voice: this.voice.list(),
    };
  }
}

// Singleton using the default sub-registries
export const creativeRegistry = new CreativeCapabilityRegistry();
