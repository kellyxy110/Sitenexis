// WebExtractionRegistry — ordered adapter chain with health checks and fallback.
// Same pattern as AIInferenceRegistry: register adapters, execute via fallback chain.

import type {
  WebExtractionAdapter,
  ExtractionOptions,
  ExtractionOutput,
  DomainCrawlOptions,
} from './interface';
import type { CrawledPage } from '@sitenexis/shared';

export class WebExtractionError extends Error {
  readonly provider: string;
  constructor(message: string, provider: string) {
    super(message);
    this.name = 'WebExtractionError';
    this.provider = provider;
  }
}

type Tier = 'primary' | 'fallback';

interface RegisteredAdapter {
  name: string;
  tier: Tier;
  adapter: WebExtractionAdapter;
}

export class WebExtractionRegistry {
  private readonly adapters: RegisteredAdapter[] = [];

  register(name: string, tier: Tier, adapter: WebExtractionAdapter): void {
    this.adapters.push({ name, tier, adapter });
    // Keep primary adapters before fallback adapters
    this.adapters.sort((a, b) => {
      const order: Record<Tier, number> = { primary: 0, fallback: 1 };
      return order[a.tier] - order[b.tier];
    });
  }

  list(): string[] {
    return this.adapters.map((a) => `${a.name}(${a.tier})`);
  }

  get(name: string): WebExtractionAdapter | undefined {
    return this.adapters.find((a) => a.name === name)?.adapter;
  }

  async extractPage(url: string, opts?: ExtractionOptions): Promise<ExtractionOutput> {
    if (this.adapters.length === 0) {
      // Lazy fallback: import fetch adapter to avoid circular deps at module level
      const { getFetchExtractionAdapter } = await import('./fetch.adapter');
      return getFetchExtractionAdapter().extractPage(url, opts);
    }

    const configured = this.adapters.filter((a) => a.adapter.isConfigured());
    if (configured.length === 0) {
      throw new WebExtractionError('No configured extraction adapters available', 'registry');
    }

    let lastError: unknown;
    for (const { name, adapter } of configured) {
      try {
        return await adapter.extractPage(url, opts);
      } catch (err) {
        lastError = err;
        // continue to next tier
        void name;
      }
    }
    throw lastError ?? new WebExtractionError('All extraction adapters failed', 'registry');
  }

  async crawlDomain(domain: string, opts?: DomainCrawlOptions): Promise<CrawledPage[]> {
    if (this.adapters.length === 0) {
      const { getFetchExtractionAdapter } = await import('./fetch.adapter');
      return getFetchExtractionAdapter().crawlDomain(domain, opts);
    }

    const configured = this.adapters.filter((a) => a.adapter.isConfigured());
    if (configured.length === 0) {
      throw new WebExtractionError('No configured extraction adapters available', 'registry');
    }

    let lastError: unknown;
    for (const { adapter } of configured) {
      try {
        return await adapter.crawlDomain(domain, opts);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new WebExtractionError('All extraction adapters failed', 'registry');
  }
}

export const webRegistry = new WebExtractionRegistry();
