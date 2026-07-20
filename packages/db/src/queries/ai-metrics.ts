import { db } from '../client';

/**
 * Persist one AI provider call event. Never throws — a metrics write failure
 * must never affect the AI response the caller is already returning to the
 * user. Callers should invoke this fire-and-forget (no await required), but
 * it's safe to await too since errors are swallowed here, not propagated.
 */
export async function recordAiCallMetric(params: {
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  skillId?: string | null;
  errorCode?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  auditId?: string | null;
  traceId?: string | null;
}): Promise<void> {
  try {
    await db.aiCallMetric.create({
      data: {
        provider: params.provider,
        model: params.model,
        latencyMs: params.latencyMs,
        success: params.success,
        ...(params.skillId != null ? { skillId: params.skillId } : {}),
        ...(params.errorCode != null ? { errorCode: params.errorCode } : {}),
        ...(params.inputTokens != null ? { inputTokens: params.inputTokens } : {}),
        ...(params.outputTokens != null ? { outputTokens: params.outputTokens } : {}),
        ...(params.estimatedCostUsd != null ? { estimatedCostUsd: params.estimatedCostUsd } : {}),
        ...(params.auditId != null ? { auditId: params.auditId } : {}),
        ...(params.traceId != null ? { traceId: params.traceId } : {}),
      },
    });
  } catch {
    // Never let observability itself become a production failure point.
  }
}

export interface AiObservabilitySummary {
  windowHours: number;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  successRate: number | null; // null when totalCalls is 0
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  totalEstimatedCostUsd: number;
  byProvider: Array<{ provider: string; calls: number; errorRate: number; avgLatencyMs: number; costUsd: number }>;
  topErrors: Array<{ errorCode: string; count: number }>;
}

/** Aggregated AI call health for the internal observability dashboard. */
export async function getAiObservabilitySummary(windowHours = 24): Promise<AiObservabilitySummary> {
  const since = new Date(Date.now() - windowHours * 3_600_000);
  const rows = await db.aiCallMetric.findMany({
    where: { createdAt: { gte: since } },
    select: { provider: true, latencyMs: true, success: true, errorCode: true, estimatedCostUsd: true },
  });

  const totalCalls = rows.length;
  const successCount = rows.filter((r) => r.success).length;
  const errorCount = totalCalls - successCount;
  const totalEstimatedCostUsd = rows.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0);

  const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
  const avgLatencyMs = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
  const p95LatencyMs = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] ?? latencies.at(-1)! : null;

  const byProviderMap = new Map<string, { calls: number; errors: number; latencySum: number; cost: number }>();
  for (const r of rows) {
    const entry = byProviderMap.get(r.provider) ?? { calls: 0, errors: 0, latencySum: 0, cost: 0 };
    entry.calls++;
    if (!r.success) entry.errors++;
    entry.latencySum += r.latencyMs;
    entry.cost += r.estimatedCostUsd ?? 0;
    byProviderMap.set(r.provider, entry);
  }
  const byProvider = [...byProviderMap.entries()]
    .map(([provider, e]) => ({
      provider,
      calls: e.calls,
      errorRate: e.calls > 0 ? e.errors / e.calls : 0,
      avgLatencyMs: e.calls > 0 ? e.latencySum / e.calls : 0,
      costUsd: e.cost,
    }))
    .sort((a, b) => b.calls - a.calls);

  const errorCountByCode = new Map<string, number>();
  for (const r of rows) {
    if (r.success || !r.errorCode) continue;
    errorCountByCode.set(r.errorCode, (errorCountByCode.get(r.errorCode) ?? 0) + 1);
  }
  const topErrors = [...errorCountByCode.entries()]
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    windowHours,
    totalCalls,
    successCount,
    errorCount,
    successRate: totalCalls > 0 ? successCount / totalCalls : null,
    avgLatencyMs,
    p95LatencyMs,
    totalEstimatedCostUsd,
    byProvider,
    topErrors,
  };
}

export interface RecentAiCall {
  id: string;
  provider: string;
  model: string;
  skillId: string | null;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  auditId: string | null;
  createdAt: Date;
}

/** Most recent AI calls, newest first — the live feed on the observability dashboard. */
export async function getRecentAiCallMetrics(limit = 50): Promise<RecentAiCall[]> {
  return db.aiCallMetric.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, provider: true, model: true, skillId: true, latencyMs: true, success: true,
      errorCode: true, inputTokens: true, outputTokens: true, estimatedCostUsd: true,
      auditId: true, createdAt: true,
    },
  });
}
