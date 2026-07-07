// CompetitiveIntelligenceRegistry — adapter chain for competitive domain analysis.
// Only non-benchmarkOnly adapters are eligible for the production fallback chain.

import type {
  CompetitiveIntelligenceAdapter,
  CompetitorAnalysisOptions,
  CompetitiveAnalysisOutput,
} from './interface';

export class CompetitiveIntelligenceError extends Error {
  readonly provider: string;
  constructor(message: string, provider = 'unknown') {
    super(message);
    this.name = 'CompetitiveIntelligenceError';
    this.provider = provider;
  }
}

type Tier = 'primary' | 'fallback';

interface RegistryEntry {
  name: string;
  tier: Tier;
  adapter: CompetitiveIntelligenceAdapter;
}

const TIER_ORDER: Record<Tier, number> = { primary: 0, fallback: 1 };

export class CompetitiveIntelligenceRegistry {
  private entries: RegistryEntry[] = [];

  register(name: string, tier: Tier, adapter: CompetitiveIntelligenceAdapter): void {
    if (adapter.benchmarkOnly) {
      throw new CompetitiveIntelligenceError(
        `Cannot register benchmark-only adapter "${name}" in the production registry`,
        name,
      );
    }
    this.entries = this.entries.filter((e) => e.name !== name);
    this.entries.push({ name, tier, adapter });
    this.entries.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  }

  unregister(name: string): void {
    this.entries = this.entries.filter((e) => e.name !== name);
  }

  list(): string[] {
    return this.entries.map((e) => `${e.name}(${e.tier})`);
  }

  get(name: string): CompetitiveIntelligenceAdapter | undefined {
    return this.entries.find((e) => e.name === name)?.adapter;
  }

  async analyzeCompetitors(
    targetDomain: string,
    competitors: string[],
    opts?: CompetitorAnalysisOptions,
  ): Promise<CompetitiveAnalysisOutput> {
    const configured = this.entries.filter((e) => e.adapter.isConfigured());

    if (configured.length === 0) {
      throw new CompetitiveIntelligenceError(
        'No configured competitive intelligence adapters — set SCRAPY_SERVICE_URL to enable',
        'registry',
      );
    }

    let lastError: unknown;
    for (const { adapter } of configured) {
      try {
        return await adapter.analyzeCompetitors(targetDomain, competitors, opts);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new CompetitiveIntelligenceError('All competitive intelligence adapters failed');
  }
}

export const competitiveRegistry = new CompetitiveIntelligenceRegistry();
