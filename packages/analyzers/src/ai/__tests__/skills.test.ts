import { describe, it, expect, beforeEach } from 'vitest';
import { skillRegistry } from '@sitenexis/adapters';
import { registerCoreSkills, entityClaritySkill, contradictionDetectionSkill } from '../skills';
import { entityClarityPrompt, contradictionDetectionPrompt, AI_SYSTEM_PROMPT } from '../prompts';

describe('registerCoreSkills', () => {
  beforeEach(() => {
    skillRegistry.clear();
  });

  it('registers all 9 core skills', () => {
    registerCoreSkills();
    const manifest = skillRegistry.list();

    expect(manifest).toHaveLength(9);
    expect(manifest.map((s) => s.id).sort()).toEqual([
      'ai-extractability-scoring',
      'contradiction-detection',
      'conversational-readiness-scoring',
      'entity-clarity-scoring',
      'entity-detection-cold',
      'entity-disambiguation',
      'entity-extraction-fast',
      'executive-summary',
      'hybrid-audit-narrative-report',
    ]);
  });

  it('is safe to call twice (idempotent registration)', () => {
    registerCoreSkills();
    expect(() => registerCoreSkills()).not.toThrow();
    expect(skillRegistry.list()).toHaveLength(9);
  });

  it('every skill manifest entry has a non-empty whenToUse (the discovery signal)', () => {
    registerCoreSkills();
    for (const skill of skillRegistry.list()) {
      expect(skill.whenToUse.length).toBeGreaterThan(10);
    }
  });
});

describe('entity-clarity-scoring skill', () => {
  it('buildPrompt produces exactly what entityClarityPrompt already produces — packaging only, no behavior change', () => {
    const prompt = entityClaritySkill.buildPrompt({ title: 'Example', bodyExcerpt: 'Some body text.' });

    expect(prompt.systemPrompt).toBe(AI_SYSTEM_PROMPT);
    expect(prompt.userPrompt).toBe(entityClarityPrompt('Example', 'Some body text.'));
  });
});

describe('contradiction-detection skill', () => {
  it('buildPrompt produces exactly what contradictionDetectionPrompt already produces', () => {
    const pageA = { url: 'https://x.com/a', excerpt: 'Founded in 2012.' };
    const pageB = { url: 'https://x.com/b', excerpt: 'Founded in 2015.' };
    const prompt = contradictionDetectionSkill.buildPrompt({ pageA, pageB });

    expect(prompt.userPrompt).toBe(contradictionDetectionPrompt(pageA, pageB));
  });
});
