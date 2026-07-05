// CreativePlanningCapability — interface for AI-driven creative brief generation.
// Takes a business/campaign brief and returns structured creative direction.

import type { CreativeContext } from '../types';

export interface CreativeBriefInput {
  objective: string;              // campaign goal: "increase brand awareness", "drive conversions"
  brand: {
    name: string;
    industry: string;
    tone: 'professional' | 'friendly' | 'premium' | 'bold' | 'playful';
    keyMessages?: string[];
  };
  audience: {
    description: string;          // "Nigerian urban professionals, 25–40"
    platform: string[];           // ["instagram", "facebook", "youtube"]
  };
  constraints?: {
    budget?: 'low' | 'medium' | 'high';
    durationDays?: number;
    avoidTopics?: string[];
  };
  ctx?: CreativeContext;
}

export interface CreativeDirection {
  conceptTitle: string;
  conceptSummary: string;
  imagePrompts: CreativeImagePrompt[];
  videoPrompts?: CreativeVideoPrompt[];
  copyVariants: CopyVariant[];
  colorPalette: string[];           // hex values
  styleNotes: string;
  estimatedAssetCount: number;
  rationale: string;
}

export interface CreativeImagePrompt {
  purpose: string;                  // "hero banner", "product showcase", "testimonial"
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  platform: string;
}

export interface CreativeVideoPrompt {
  purpose: string;
  prompt: string;
  durationSeconds: number;
  platform: string;
}

export interface CopyVariant {
  type: 'headline' | 'body' | 'cta' | 'caption';
  text: string;
  platform?: string;
}

export interface CreativePlanningAdapter {
  readonly provider: string;
  isConfigured(): boolean;
  plan(input: CreativeBriefInput): Promise<CreativeDirection>;
}
