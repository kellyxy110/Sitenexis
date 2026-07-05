// Research-tier image adapters — marked experimental, not wired into primary registry.
// ponpoke/flux2-klein-9b-uncensored-text-encoder — research FLUX text encoder variant.
// SulphurAI/Sulphur-2-base — research base model.
// These are available for direct instantiation in benchmarks and experiments only.

import { HuggingFaceImageBase } from './huggingface.base';
import type { ImageModelConstraints, ImageGenerationAdapter } from './interface';

const RESEARCH_BASE_CONSTRAINTS: ImageModelConstraints = {
  minWidth: 256,
  maxWidth: 1024,
  minHeight: 256,
  maxHeight: 1024,
  defaultWidth: 1024,
  defaultHeight: 1024,
  maxSteps: 50,
  defaultSteps: 30,
  supportsNegativePrompt: false,
  supportsGuidanceScale: false,
  supportsSeed: true,
  maxBatchSize: 1,
  estimatedLatencyMs: 60_000,
};

export class FluxKleinAdapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'flux-klein';
  readonly modelId = 'ponpoke/flux2-klein-9b-uncensored-text-encoder';
  readonly tier = 'research' as const;
  readonly constraints: ImageModelConstraints = {
    ...RESEARCH_BASE_CONSTRAINTS,
    estimatedLatencyMs: 70_000,
  };
}

export class SulphurAdapter extends HuggingFaceImageBase implements ImageGenerationAdapter {
  readonly provider = 'sulphur';
  readonly modelId = 'SulphurAI/Sulphur-2-base';
  readonly tier = 'research' as const;
  readonly constraints: ImageModelConstraints = {
    ...RESEARCH_BASE_CONSTRAINTS,
    estimatedLatencyMs: 90_000,
  };
}

export function getFluxKleinAdapter(hfToken?: string): FluxKleinAdapter {
  return new FluxKleinAdapter(hfToken);
}

export function getSulphurAdapter(hfToken?: string): SulphurAdapter {
  return new SulphurAdapter(hfToken);
}
