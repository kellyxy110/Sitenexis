import type { FixPlanItem, FixPlanDependencyChain } from '@sitenexis/shared';

interface DependencyRule {
  blocker: (item: FixPlanItem) => boolean;
  blocked: (item: FixPlanItem) => boolean;
}

const DEPENDENCY_RULES: DependencyRule[] = [
  // Schema must be fixed before trust scores can improve
  {
    blocker: (i) => i.module === 'schema' && i.severity === 'critical',
    blocked: (i) => i.module === 'machine-trust' || i.module === 'semantic-trust',
  },
  // H1/title must be fixed before AI extractability improves
  {
    blocker: (i) => i.module === 'seo' && (i.type.includes('missing_h1') || i.type.includes('missing_title')),
    blocked: (i) => i.module === 'ai-visibility' || i.module === 'machine-readability',
  },
  // Entity issues must be resolved before citation probability improves
  {
    blocker: (i) => i.module === 'entity' && i.severity === 'critical',
    blocked: (i) => i.module === 'citation',
  },
  // Crawlability issues block everything downstream
  {
    blocker: (i) => i.module === 'seo' && (i.type.includes('noindex') || i.type.includes('blocked_by_robots')),
    blocked: (i) => i.module !== 'seo',
  },
  // Content quality must improve before recommendation surface expands
  {
    blocker: (i) => i.module === 'content' && i.severity === 'critical',
    blocked: (i) => i.module === 'recommendation-surface',
  },
  // Trust issues must be resolved before temporal authority stabilizes
  {
    blocker: (i) => i.module === 'semantic-trust' && i.severity === 'critical',
    blocked: (i) => i.module === 'temporal-authority',
  },
];

export function applyDependencies(items: FixPlanItem[]): void {
  for (const item of items) {
    for (const rule of DEPENDENCY_RULES) {
      if (rule.blocked(item)) {
        const blockers = items.filter((other) => other.id !== item.id && rule.blocker(other));
        for (const blocker of blockers) {
          if (!item.dependsOn.includes(blocker.id)) {
            item.dependsOn.push(blocker.id);
          }
        }
      }
    }
  }
}

export function buildDependencyChains(items: FixPlanItem[]): FixPlanDependencyChain[] {
  const chains: FixPlanDependencyChain[] = [];

  const hasBlockedTrust = items.some((i) =>
    (i.module === 'machine-trust' || i.module === 'semantic-trust') && i.dependsOn.length > 0
  );
  if (hasBlockedTrust) {
    const schemaBlockers = items.filter((i) => i.module === 'schema' && i.severity === 'critical');
    if (schemaBlockers.length > 0) {
      chains.push({
        name: 'Schema → Trust Pipeline',
        description: 'Critical schema issues must be fixed before trust scores can improve',
        steps: [
          'Fix critical schema issues (missing/invalid structured data)',
          'Re-audit to regenerate trust signals from corrected schema',
          'Trust scores will recalculate with accurate schema alignment',
        ],
      });
    }
  }

  const hasCrawlBlockers = items.some((i) =>
    i.module === 'seo' && (i.type.includes('noindex') || i.type.includes('blocked_by_robots'))
  );
  if (hasCrawlBlockers) {
    chains.push({
      name: 'Crawlability Foundation',
      description: 'Blocked/noindexed pages prevent all downstream analysis',
      steps: [
        'Remove noindex directives from pages that should be indexed',
        'Update robots.txt to allow crawling of important sections',
        'Verify pages are accessible and returning 200 status codes',
        'All visibility and trust analysis depends on crawlable pages',
      ],
    });
  }

  const hasEntityBlocking = items.some((i) =>
    i.module === 'citation' && i.dependsOn.length > 0
  );
  if (hasEntityBlocking) {
    chains.push({
      name: 'Entity → Citation Pipeline',
      description: 'Entity disambiguation must be resolved for accurate citation probability',
      steps: [
        'Fix critical entity inconsistencies across pages',
        'Ensure primary entity is clearly defined with consistent attributes',
        'Citation probability scoring will improve with clean entity data',
      ],
    });
  }

  const hasSeoBlockingAi = items.some((i) =>
    (i.module === 'ai-visibility' || i.module === 'machine-readability') && i.dependsOn.length > 0
  );
  if (hasSeoBlockingAi) {
    chains.push({
      name: 'SEO Structure → AI Visibility',
      description: 'Basic SEO structure (H1, title) must be in place for AI systems to extract content',
      steps: [
        'Add missing H1 headings and page titles',
        'Fix heading hierarchy for semantic structure',
        'AI extractability and machine readability scores will improve',
      ],
    });
  }

  return chains;
}
