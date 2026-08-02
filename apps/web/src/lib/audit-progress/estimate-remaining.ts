/**
 * ETA estimation, isolated from progress calculation so it can be swapped for
 * a real historical-telemetry-based model later without touching the progress
 * engine itself. No historical data is wired in yet — this is intentionally
 * conservative and defaults to an honest "Estimating..." until there's enough
 * signal from THIS run alone to extrapolate.
 */

export interface EstimateRemainingInput {
  elapsedMs: number;
  /** 0-100, from computeAuditProgress — never fabricated beyond what it reports. */
  progress: number;
}

const MIN_ELAPSED_MS_FOR_ESTIMATE = 8_000;
const MIN_PROGRESS_FOR_ESTIMATE = 15;

export function estimateRemaining({ elapsedMs, progress }: EstimateRemainingInput): string {
  if (elapsedMs < MIN_ELAPSED_MS_FOR_ESTIMATE || progress < MIN_PROGRESS_FOR_ESTIMATE || progress >= 100) {
    return 'Estimating...';
  }

  // Conservative linear extrapolation from observed throughput this run only,
  // with a 20% buffer since real audits speed up/slow down non-linearly across phases.
  const msPerPercent = elapsedMs / progress;
  const remainingMs = msPerPercent * (100 - progress) * 1.2;

  return formatDuration(remainingMs);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `~${totalSeconds}s remaining`;
  const minutes = Math.round(totalSeconds / 60);
  return `~${minutes} min remaining`;
}
