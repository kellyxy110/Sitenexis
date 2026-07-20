import type { SkillDefinition, SkillManifest } from './interface';

export class SkillRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillRegistryError';
  }
}

/**
 * In-memory registry of skills, keyed by id. Mirrors the register()/get()/list()
 * shape already used by AIInferenceRegistry and the creative/web-extraction
 * registries, so this reads as the same house pattern, not a new one.
 */
export class SkillRegistry {
  private skills = new Map<string, SkillDefinition<any>>();

  /** Registering the same id twice with a different version throws — that's a real bug to catch,
   *  not something to silently overwrite. Re-registering the exact same version is a no-op
   *  (safe for hot-reload in dev, where a module can re-evaluate). */
  register<TInput>(skill: SkillDefinition<TInput>): void {
    const existing = this.skills.get(skill.id);
    if (existing && existing.version !== skill.version) {
      throw new SkillRegistryError(
        `Skill "${skill.id}" is already registered at version ${existing.version} — ` +
        `refusing to silently replace it with version ${skill.version}. ` +
        `If this is an intentional upgrade, give it a new id or remove the old registration first.`,
      );
    }
    this.skills.set(skill.id, skill);
  }

  get<TInput = unknown>(id: string): SkillDefinition<TInput> | undefined {
    return this.skills.get(id);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  /** Manifest list for discovery UIs — never exposes buildPrompt. */
  list(): SkillManifest[] {
    return [...this.skills.values()].map(({ id, version, description, whenToUse, recommendedTaskType }) => ({
      id, version, description, whenToUse,
      ...(recommendedTaskType !== undefined ? { recommendedTaskType } : {}),
    }));
  }

  /** Test-only: clears all registrations so test suites don't leak state across files. */
  clear(): void {
    this.skills.clear();
  }
}

export const skillRegistry = new SkillRegistry();
