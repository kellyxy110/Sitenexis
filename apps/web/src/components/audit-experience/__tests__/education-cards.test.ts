import { describe, it, expect } from 'vitest';
import { EDUCATION_CARDS } from '../education-cards';

const NAMED_AI_SYSTEMS = /chatgpt|gemini|claude|perplexity|\bgoogle\b/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe('EDUCATION_CARDS', () => {
  it('has at least 40 cards', () => {
    expect(EDUCATION_CARDS.length).toBeGreaterThanOrEqual(40);
  });

  it('every card has a unique id', () => {
    const ids = EDUCATION_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every card has a non-empty title, category, and body', () => {
    for (const card of EDUCATION_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.category.length).toBeGreaterThan(0);
      expect(card.body.length).toBeGreaterThan(0);
    }
  });

  it('every card body is roughly within the 40-80 word explanation range', () => {
    for (const card of EDUCATION_CARDS) {
      const count = wordCount(card.body);
      expect(count, `${card.id}: ${count} words`).toBeGreaterThanOrEqual(30);
      expect(count, `${card.id}: ${count} words`).toBeLessThanOrEqual(90);
    }
  });

  it('never names a specific AI system as making a definitive internal ranking/citation claim', () => {
    for (const card of EDUCATION_CARDS) {
      expect(card.body, `${card.id} mentions a named AI system`).not.toMatch(NAMED_AI_SYSTEMS);
      expect(card.title, `${card.id} title mentions a named AI system`).not.toMatch(NAMED_AI_SYSTEMS);
    }
  });

  it('covers the required topic set from the spec, not just a handful of repeats', () => {
    const categories = new Set(EDUCATION_CARDS.map((c) => c.category));
    const required = [
      'AI Visibility', 'Citation Probability', 'Machine Trust', 'Information Gain',
      'Schema', 'Robots.txt', 'Sitemaps', 'E-E-A-T', 'Knowledge Graphs', 'RAG',
    ];
    for (const cat of required) expect(categories.has(cat)).toBe(true);
  });

  it('includes SiteNexis-specific cards explaining the product itself', () => {
    const sitenexisCards = EDUCATION_CARDS.filter((c) => c.category === 'SiteNexis');
    expect(sitenexisCards.length).toBeGreaterThanOrEqual(8);
  });
});
