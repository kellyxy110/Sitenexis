import type { ScoutPageIntent, ScoutIntentType } from '@sitenexis/shared';

interface PageFeatures {
  url: string;
  hasSchema: boolean;
  schemaTypes: string[];
  headings: string[];
  wordCount: number;
}

const INTENT_STRUCTURAL_SIGNALS: Record<ScoutIntentType, (page: PageFeatures) => number> = {
  informational: (p) => {
    let score = 0;
    if (p.wordCount >= 500) score += 30;
    if (p.headings.length >= 3) score += 30;
    if (p.hasSchema && p.schemaTypes.some((t) => /article|blog/i.test(t))) score += 40;
    else if (p.hasSchema) score += 15;
    return Math.min(100, score);
  },
  commercial: (p) => {
    let score = 0;
    if (p.hasSchema && p.schemaTypes.some((t) => /product|offer|review/i.test(t))) score += 40;
    const urlSignals = /pric|product|plan|buy|shop|checkout/i.test(p.url);
    if (urlSignals) score += 25;
    const headingSignals = p.headings.some((h) => /pric|feature|plan|buy|get started/i.test(h));
    if (headingSignals) score += 20;
    if (p.wordCount >= 200) score += 15;
    return Math.min(100, score);
  },
  navigational: (p) => {
    let score = 0;
    if (/about|contact|team|career|login|sign/i.test(p.url)) score += 40;
    if (p.hasSchema && p.schemaTypes.some((t) => /organization|person/i.test(t))) score += 30;
    if (p.headings.some((h) => /about|team|contact|mission/i.test(h))) score += 20;
    score += 10;
    return Math.min(100, score);
  },
  research: (p) => {
    let score = 0;
    if (p.wordCount >= 1000) score += 25;
    if (p.headings.length >= 5) score += 20;
    if (p.hasSchema && p.schemaTypes.some((t) => /report|study|dataset/i.test(t))) score += 35;
    if (p.headings.some((h) => /data|result|finding|method|conclusion|analysis/i.test(h))) score += 20;
    return Math.min(100, score);
  },
  creation: (p) => {
    let score = 0;
    if (/tool|generator|calculator|builder|template|create/i.test(p.url)) score += 40;
    if (p.hasSchema && p.schemaTypes.some((t) => /softwareapplication|webtool/i.test(t))) score += 30;
    if (p.headings.some((h) => /generate|create|build|calculate/i.test(h))) score += 20;
    score += 10;
    return Math.min(100, score);
  },
  learn_and_solve: (p) => {
    let score = 0;
    if (p.hasSchema && p.schemaTypes.some((t) => /howto|faqpage/i.test(t))) score += 40;
    if (p.headings.some((h) => /how to|step|tutorial|guide|fix|solve/i.test(h))) score += 25;
    if (p.wordCount >= 400) score += 15;
    if (p.headings.length >= 4) score += 15;
    score += 5;
    return Math.min(100, score);
  },
  local: (p) => {
    let score = 0;
    if (p.hasSchema && p.schemaTypes.some((t) => /localbusiness|place|postaladdress/i.test(t))) score += 45;
    if (/location|store|branch|near|local|address/i.test(p.url)) score += 25;
    if (p.headings.some((h) => /location|visit|find us|hour|direction/i.test(h))) score += 20;
    score += 10;
    return Math.min(100, score);
  },
};

export function computeIntentAlignment(
  pageIntents: ScoutPageIntent[],
  pageFeatures: PageFeatures[],
): number {
  if (pageIntents.length === 0) return 0;

  const featureMap = new Map(pageFeatures.map((p) => [p.url, p]));
  let totalAlignment = 0;
  let scored = 0;

  for (const intent of pageIntents) {
    const features = featureMap.get(intent.url);
    if (!features) continue;

    const scorer = INTENT_STRUCTURAL_SIGNALS[intent.primaryIntent];
    totalAlignment += scorer(features);
    scored++;
  }

  return scored > 0 ? Math.round(totalAlignment / scored) : 0;
}
