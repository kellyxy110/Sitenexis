// Kokoro voice adapter — future provider stub.
// Kokoro is a high-quality open TTS model (82M params, Apache 2.0).
// HuggingFace model: hexgrad/Kokoro-82M (or the community ONNX variant).
// This adapter is a stub until the HuggingFace Inference API supports Kokoro directly.
//
// Current status: Kokoro is run locally via ONNX or Gradio spaces.
// Integration path: wire to the Kokoro Gradio space API or a self-hosted endpoint.

import { randomUUID } from 'crypto';
import type { VoiceAsset, CreativeProviderHealth } from '../types';
import type { VoiceGenerationInput, VoiceModelConstraints, VoiceGenerationAdapter } from './interface';
import { validatePrompt } from '../security';

const CONSTRAINTS: VoiceModelConstraints = {
  maxTextChars: 5_000,
  supportedVoices: [
    'af_heart', 'af_bella', 'af_sarah', 'am_adam', 'am_michael',
    'bf_emma', 'bf_isabella', 'bm_george', 'bm_lewis',
  ],
  supportedLanguages: ['en-US', 'en-GB'],
  defaultVoice: 'af_heart',
  supportsSpeed: true,
  estimatedLatencyMs: 2_000,
};

export class KokoroAdapter implements VoiceGenerationAdapter {
  readonly provider = 'kokoro';
  readonly modelId = 'hexgrad/Kokoro-82M';
  readonly tier = 'stub' as const;
  readonly constraints = CONSTRAINTS;

  private readonly endpointUrl: string;

  constructor(endpointUrl?: string) {
    // Accepts a custom Gradio space URL or self-hosted endpoint
    this.endpointUrl = endpointUrl
      ?? process.env['KOKORO_ENDPOINT_URL']
      ?? process.env['KOKORO_GRADIO_URL']
      ?? '';
  }

  isConfigured(): boolean {
    return this.endpointUrl.startsWith('http');
  }

  async generate(input: VoiceGenerationInput): Promise<VoiceAsset> {
    if (!this.isConfigured()) {
      throw new Error('Kokoro adapter not configured — set KOKORO_ENDPOINT_URL');
    }

    const text = validatePrompt(input.text, 'text');
    if (text.length > this.constraints.maxTextChars) {
      throw new Error(`Text exceeds ${this.constraints.maxTextChars} character limit`);
    }

    const voice = input.voice ?? this.constraints.defaultVoice;
    const speed = Math.max(0.5, Math.min(2.0, input.speed ?? 1.0));
    const start = Date.now();

    // Gradio API call: POST /run/predict with fn_index matching the voice gen endpoint
    const res = await fetch(`${this.endpointUrl}/run/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn_index: 0,
        data: [text, voice, speed],
      }),
      signal: AbortSignal.timeout(input.ctx?.timeoutMs ?? 30_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Kokoro endpoint returned ${res.status}: ${err.slice(0, 200)}`);
    }

    const json = await res.json() as { data?: Array<{ name?: string; data?: string }> };
    const audioData = json.data?.[0];
    if (!audioData) throw new Error('Kokoro returned no audio data');

    let buffer: Buffer;
    if (audioData.data) {
      // base64 encoded audio
      const b64 = audioData.data.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
    } else {
      throw new Error('Kokoro response format not recognized');
    }

    const latencyMs = Date.now() - start;
    // WAV header: sample rate at bytes 24-27, data length at bytes 40-43
    let sampleRate = 24_000;
    try {
      sampleRate = buffer.readUInt32LE(24);
    } catch { /* use default */ }
    const dataSizeBytes = buffer.length - 44;  // subtract WAV header
    const durationMs = dataSizeBytes > 0 ? Math.round((dataSizeBytes / 2 / sampleRate) * 1000) : 0;

    return {
      id: randomUUID(),
      buffer,
      mimeType: 'audio/wav',
      durationMs,
      sampleRate,
      text,
      voice,
      model: this.modelId,
      provider: this.provider,
      speed,
      generatedAt: new Date(),
      latencyMs,
    };
  }

  async healthCheck(): Promise<CreativeProviderHealth> {
    if (!this.isConfigured()) {
      return { provider: this.provider, model: this.modelId, status: 'unavailable', latencyMs: 0, checkedAt: new Date(), details: 'KOKORO_ENDPOINT_URL not configured (stub adapter)' };
    }
    const start = Date.now();
    try {
      const res = await fetch(`${this.endpointUrl}/info`, { signal: AbortSignal.timeout(5_000) });
      return {
        provider: this.provider, model: this.modelId,
        status: res.ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      return { provider: this.provider, model: this.modelId, status: 'unavailable', latencyMs: Date.now() - start, checkedAt: new Date(), details: err instanceof Error ? err.message : String(err) };
    }
  }
}

let _instance: KokoroAdapter | undefined;

export function getKokoroAdapter(endpointUrl?: string): KokoroAdapter {
  if (!_instance || endpointUrl) _instance = new KokoroAdapter(endpointUrl);
  return _instance;
}
