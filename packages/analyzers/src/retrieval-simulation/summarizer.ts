import type { Chunk } from './chunker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummarisationResult {
  pageUrl: string;
  summarisationLossScore: number;
  fragileClaimsCount: number;
  truncationZoneWarnings: string[];
  compressionRisk: 'low' | 'medium' | 'high' | 'critical';
}

// Patterns for time-sensitive facts that are vulnerable to AI compression
const TIME_SENSITIVE_PATTERNS = [
  /\b(in|since|as of|from|until|by)\s+\d{4}\b/i,
  /\b\d+(\.\d+)?%\b/,
  /\bv\d+(\.\d+)+\b/i,
  /\$[\d,]+(\.\d+)?[kmb]?\b/i,
  /\b(q[1-4]|fy|fiscal year)\s*\d{2,4}\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
];

// Patterns for fragile multi-chunk claims — facts needing context from other chunks to be accurate
const FRAGILE_CLAIM_PATTERNS = [
  /\b(as mentioned (above|below|earlier)|see (above|below|section)|refer to\b)/i,
  /\b(this|these|those|the above|the following)\s+(results?|findings?|data|numbers?|figures?)\b/i,
  /\bcompared (to|with) (the|our|this)\b/i,
  /\b(however|therefore|thus|consequently|as a result)\b/i,
  /\bwhich (is|was|means|indicates|shows)\b/i,
];

// Context window limit — content beyond this character position is at truncation risk
// Estimated for a 4096-token context window at 4 chars/token, with ~50% reserved for system/query
const TRUNCATION_RISK_CHARS = 4096 * 4 * 0.5;

// ─── Summarisation degradation analysis ──────────────────────────────────────

/**
 * Models how much meaning is lost when retrieved chunks are compressed into
 * an AI-generated answer. Returns a loss score (0=total loss, 100=no loss).
 */
export function analyseSummarisationDegradation(
  pageUrl: string,
  chunks: Chunk[],
  bodyText: string,
): SummarisationResult {
  if (chunks.length === 0) {
    return {
      pageUrl,
      summarisationLossScore: 50,
      fragileClaimsCount: 0,
      truncationZoneWarnings: [],
      compressionRisk: 'medium',
    };
  }

  let penaltyTotal = 0;
  let fragileClaimsCount = 0;
  const truncationZoneWarnings: string[] = [];

  for (const chunk of chunks) {
    // Dangling references degrade under summarisation — context is lost
    if (chunk.hasDanglingReference) {
      penaltyTotal += 8;
      fragileClaimsCount++;
    }

    // Fragile claim patterns
    const fragileMatches = FRAGILE_CLAIM_PATTERNS.filter((p) => p.test(chunk.text));
    fragileClaimsCount += fragileMatches.length;
    penaltyTotal += fragileMatches.length * 4;

    // Chunks too small to be meaningful in a summarised context
    if (chunk.tokenEstimate < 80) {
      penaltyTotal += 5;
    }

    // Time-sensitive facts in short chunks are frequently dropped by summarisers
    const hasTimeSensitive = TIME_SENSITIVE_PATTERNS.some((p) => p.test(chunk.text));
    if (hasTimeSensitive && chunk.tokenEstimate < 150) {
      penaltyTotal += 6;
    }

    // Truncation zone check
    if (chunk.startChar > TRUNCATION_RISK_CHARS) {
      const preview = chunk.text.slice(0, 80).replace(/\n/g, ' ');
      truncationZoneWarnings.push(
        `"${preview}…" — positioned beyond the typical context window (char ${chunk.startChar}).`,
      );
    }
  }

  // Global text checks — broad structural signals of summarisation risk
  const timeSensitiveCount = TIME_SENSITIVE_PATTERNS.filter((p) => p.test(bodyText)).length;
  penaltyTotal += timeSensitiveCount * 2;

  // Score: start at 100 and subtract cumulative penalties, min 0
  const summarisationLossScore = Math.max(0, Math.round(100 - penaltyTotal));

  const compressionRisk = classifyCompressionRisk(summarisationLossScore);

  return {
    pageUrl,
    summarisationLossScore,
    fragileClaimsCount,
    truncationZoneWarnings: truncationZoneWarnings.slice(0, 10),
    compressionRisk,
  };
}

function classifyCompressionRisk(
  score: number,
): SummarisationResult['compressionRisk'] {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}
