import type { SemanticDriftRecord, TemporalIssue } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriftResult {
  semanticDriftIndex: number;
  driftedPages: SemanticDriftRecord[];
  issues: TemporalIssue[];
}

// ─── Semantic drift detection ─────────────────────────────────────────────────

/**
 * Detects semantic drift between two audit snapshots.
 *
 * Semantic drift = pages where the topic cluster has shifted between audits.
 * Measured using keyword overlap between current and previous body text
 * (embeddings are used by the agent when available — this is the fallback).
 *
 * On first audit (no prior snapshot): returns zero-drift baseline.
 */
export function analyseSemanticDrift(
  currentPageTexts: Map<string, string>,
  priorPageTexts?: Map<string, string>,
): DriftResult {
  if (!priorPageTexts || priorPageTexts.size === 0) {
    return {
      semanticDriftIndex: 0,
      driftedPages: [],
      issues: [],
    };
  }

  const driftedPages: SemanticDriftRecord[] = [];
  const issues: TemporalIssue[] = [];
  let totalDrift = 0;
  let comparedCount = 0;

  for (const [url, currentText] of currentPageTexts) {
    const priorText = priorPageTexts.get(url);
    if (!priorText) continue;

    const driftScore = computeKeywordDrift(priorText, currentText);
    comparedCount++;
    totalDrift += driftScore;

    if (driftScore > 0.4) {
      const priorCluster = extractTopicCluster(priorText);
      const currentCluster = extractTopicCluster(currentText);

      driftedPages.push({
        pageUrl: url,
        driftScore: Math.round(driftScore * 100) / 100,
        previousTopicCluster: priorCluster,
        currentTopicCluster: currentCluster,
        detectedAt: new Date(),
      });

      issues.push({
        type: 'semantic_drift_detected',
        severity: driftScore > 0.7 ? 'critical' : 'warning',
        pageUrl: url,
        description: `Page topic cluster shifted from "${priorCluster}" to "${currentCluster}" (drift score: ${(driftScore * 100).toFixed(0)}%). AI systems may have formed trust models based on the previous topic.`,
        recommendation: 'If the topic change is intentional, add a canonical redirect to the new destination. Otherwise review why the page content changed significantly.',
      });
    }
  }

  const semanticDriftIndex = comparedCount === 0
    ? 0
    : Math.round((totalDrift / comparedCount) * 100) / 100;

  return {
    semanticDriftIndex: Math.min(1, semanticDriftIndex),
    driftedPages,
    issues,
  };
}

// ─── Keyword-based drift approximation ───────────────────────────────────────

/**
 * Approximates semantic drift using top-keyword Jaccard distance.
 * Returns 0 (no drift) to 1 (complete topical pivot).
 */
function computeKeywordDrift(priorText: string, currentText: string): number {
  const priorKeywords = extractKeywords(priorText);
  const currentKeywords = extractKeywords(currentText);

  const intersection = new Set([...priorKeywords].filter((k) => currentKeywords.has(k)));
  const union = new Set([...priorKeywords, ...currentKeywords]);

  if (union.size === 0) return 0;

  const jaccardSimilarity = intersection.size / union.size;
  return 1 - jaccardSimilarity;
}

function extractKeywords(text: string): Set<string> {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'this', 'that', 'these',
    'those', 'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  // Frequency map
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Top 50 keywords by frequency
  return new Set(
    [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([w]) => w),
  );
}

function extractTopicCluster(text: string): string {
  const keywords = extractKeywords(text);
  return [...keywords].slice(0, 5).join(', ') || 'unknown';
}
