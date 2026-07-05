// VoiceGenerationCapability — canonical interface for TTS adapters.

import type { VoiceAsset, CreativeContext, CreativeProviderHealth } from '../types';

export interface VoiceGenerationInput {
  text: string;
  voice?: string;             // voice/speaker ID; defaults to model's default voice
  speed?: number;             // playback speed multiplier; 0.5–2.0
  language?: string;          // BCP 47 language tag e.g. "en-US", "fr-FR"
  outputFormat?: 'wav' | 'mp3' | 'opus';
  ctx?: CreativeContext;
}

export interface VoiceModelConstraints {
  maxTextChars: number;
  supportedVoices: readonly string[];
  supportedLanguages: readonly string[];
  defaultVoice: string;
  supportsSpeed: boolean;
  estimatedLatencyMs: number;
}

export interface VoiceGenerationAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly tier: 'primary' | 'fallback' | 'stub';
  readonly constraints: VoiceModelConstraints;
  isConfigured(): boolean;
  generate(input: VoiceGenerationInput): Promise<VoiceAsset>;
  healthCheck(): Promise<CreativeProviderHealth>;
}
