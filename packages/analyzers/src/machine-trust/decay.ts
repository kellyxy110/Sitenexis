import type { CrawledPage, TrustDegradationSignal, TrustIssue } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecayResult {
  score: number;
  issues: TrustIssue[];
  degradationSignals: TrustDegradationSignal[];
}

// ─── Trust degradation detection ─────────────────────────────────────────────

/**
 * Detects signals that indicate trust has been formed and then damaged.
 *
 * On first audit (no prior data): returns a healthy baseline score with no
 * degradation signals — decay only becomes visible across audit comparisons.
 * The agent handles historical comparisons by passing prior schema data.
 */
export function analyseTrustDecay(
  pages: CrawledPage[],
  priorSchemaPageUrls?: string[],
): DecayResult {
  const issues: TrustIssue[] = [];
  const degradationSignals: TrustDegradationSignal[] = [];

  // Detect pages that lost schema markup (compared to prior audit if available)
  if (priorSchemaPageUrls && priorSchemaPageUrls.length > 0) {
    const currentSchemaUrls = new Set(
      pages.filter((p) => (p.schemaMarkup ?? []).length > 0).map((p) => p.url),
    );

    for (const priorUrl of priorSchemaPageUrls) {
      if (!currentSchemaUrls.has(priorUrl)) {
        degradationSignals.push({
          signalType: 'schema_removal',
          entity: priorUrl,
          previousValue: 'schema present',
          currentValue: 'schema absent',
          detectedAt: new Date(),
          severityImpact: 8,
        });
        issues.push({
          type: 'schema_removal_detected',
          severity: 'warning',
          entity: priorUrl,
          description: `Schema markup was present in a previous audit but is now absent on ${priorUrl}.`,
          recommendation: 'Restore schema markup. Schema removal is interpreted by AI systems as a trust degradation signal.',
        });
      }
    }
  }

  // Current-state decay signals (detectable without historical comparison)
  const { currentIssues, currentSignals } = detectCurrentDecaySignals(pages);
  issues.push(...currentIssues);
  degradationSignals.push(...currentSignals);

  // Trust degradation resistance score
  const totalImpact = degradationSignals.reduce((sum, s) => sum + s.severityImpact, 0);
  const score = Math.max(0, Math.round(100 - totalImpact));

  return { score, issues, degradationSignals };
}

function detectCurrentDecaySignals(pages: CrawledPage[]): {
  currentIssues: TrustIssue[];
  currentSignals: TrustDegradationSignal[];
} {
  const currentIssues: TrustIssue[] = [];
  const currentSignals: TrustDegradationSignal[] = [];

  // Pages with schema but no dateModified — trust decay accelerates without freshness signals
  const schemaPages = pages.filter((p) => (p.schemaMarkup ?? []).length > 0);
  const noDateModified = schemaPages.filter(
    (p) => !p.schemaMarkup.some((m) => m && typeof m === 'object' && 'dateModified' in m),
  );

  if (noDateModified.length > schemaPages.length * 0.5 && schemaPages.length > 0) {
    currentSignals.push({
      signalType: 'attribute_change',
      entity: 'site-wide',
      previousValue: 'dateModified present',
      currentValue: 'dateModified absent',
      detectedAt: new Date(),
      severityImpact: 5,
    });
    currentIssues.push({
      type: 'missing_date_modified',
      severity: 'warning',
      entity: 'site-wide',
      description: `${noDateModified.length} schema page(s) are missing dateModified — AI systems apply accelerated trust decay to content without freshness signals.`,
      recommendation: 'Add dateModified to all schema markup reflecting the actual last modification date.',
    });
  }

  // Detect sameAs links that resolve to 404s (indicated by broken external links)
  const suspectedBrokenSameAs = pages.filter((p) =>
    p.schemaMarkup.some((m) => {
      if (!m || typeof m !== 'object') return false;
      const sameAs = (m as Record<string, unknown>)['sameAs'];
      if (typeof sameAs !== 'string') return false;
      return p.externalLinks.includes(sameAs);
    }),
  );

  // Check if any known external links appear to be broken via status codes
  // (direct resolution happens in the agent; here we flag pages with sameAs that aren't in externalLinks)
  const pagesWithSameAsNotLinked = pages.filter((p) =>
    p.schemaMarkup.some((m) => {
      if (!m || typeof m !== 'object') return false;
      const sameAs = (m as Record<string, unknown>)['sameAs'];
      if (typeof sameAs !== 'string') return false;
      return !p.externalLinks.includes(sameAs);
    }),
  );
  void suspectedBrokenSameAs;

  if (pagesWithSameAsNotLinked.length > 0) {
    currentSignals.push({
      signalType: 'external_source_loss',
      entity: 'sameAs links',
      previousValue: 'sameAs URL present in schema',
      currentValue: 'sameAs URL not linked from page',
      detectedAt: new Date(),
      severityImpact: 4,
    });
    currentIssues.push({
      type: 'same_as_not_verified',
      severity: 'info',
      entity: 'site-wide',
      description: `${pagesWithSameAsNotLinked.length} page(s) have sameAs schema URLs not found in their external links — these cannot be verified as live.`,
      recommendation: 'Verify that all sameAs URLs resolve correctly and link to the intended external entity profiles.',
    });
  }

  return { currentIssues, currentSignals };
}
