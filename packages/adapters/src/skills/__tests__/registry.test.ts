import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry, SkillRegistryError } from '../registry';
import type { SkillDefinition } from '../interface';

function makeSkill(overrides: Partial<SkillDefinition<{ text: string }>> = {}): SkillDefinition<{ text: string }> {
  return {
    id: 'echo-skill',
    version: '1.0.0',
    description: 'Echoes the input text back as the user prompt.',
    whenToUse: 'Use in tests only.',
    buildPrompt: ({ text }) => ({ systemPrompt: 'You are an echo.', userPrompt: text }),
    ...overrides,
  };
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('registers and retrieves a skill by id', () => {
    const skill = makeSkill();
    registry.register(skill);

    expect(registry.has('echo-skill')).toBe(true);
    expect(registry.get('echo-skill')).toBe(skill);
  });

  it('returns undefined for an unregistered id', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('buildPrompt produces a valid two-part prompt', () => {
    registry.register(makeSkill());
    const skill = registry.get<{ text: string }>('echo-skill')!;
    const prompt = skill.buildPrompt({ text: 'hello' });

    expect(prompt.systemPrompt).toBe('You are an echo.');
    expect(prompt.userPrompt).toBe('hello');
  });

  it('re-registering the same id at the same version is a no-op, not an error', () => {
    registry.register(makeSkill());
    expect(() => registry.register(makeSkill())).not.toThrow();
    expect(registry.list()).toHaveLength(1);
  });

  it('re-registering the same id at a different version throws, rather than silently replacing it', () => {
    registry.register(makeSkill());
    expect(() => registry.register(makeSkill({ version: '2.0.0' }))).toThrow(SkillRegistryError);
  });

  it('list() returns a manifest without exposing buildPrompt', () => {
    registry.register(makeSkill());
    const manifest = registry.list();

    expect(manifest).toEqual([
      { id: 'echo-skill', version: '1.0.0', description: 'Echoes the input text back as the user prompt.', whenToUse: 'Use in tests only.' },
    ]);
    expect('buildPrompt' in manifest[0]!).toBe(false);
  });

  it('clear() removes all registrations', () => {
    registry.register(makeSkill());
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});
