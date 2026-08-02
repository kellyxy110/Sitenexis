/**
 * Shared types and stage-check helpers for /api/health, split out of route.ts
 * because Next.js App Router route files may only export HTTP handlers and a
 * small fixed set of config values — no other export is type-checkable, which
 * also means these checks can't be unit tested directly from route.ts.
 */

export interface DiagnosticStage {
  stage: string;
  status: 'ok' | 'error' | 'skipped' | 'not_configured';
  latency_ms?: number;
  error?: string;
  detail?: unknown;
  recommended_fix?: string;
}

export async function withTiming<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const t = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t };
}

/**
 * Stage 7: Worker heartbeat (is a BullMQ worker process running?)
 *
 * SiteNexis's production audit path runs entirely through the serverless runner
 * (runServerlessAudit) — no BullMQ worker is deployed. A never-written heartbeat
 * key is therefore the *expected* steady state, not a fault, and must not flip
 * the overall health response to 503. A STALE heartbeat is different: it means a
 * worker WAS running recently and has since gone dark — that is a real
 * regression and still reports as an error.
 */
export async function checkWorkerHeartbeat(): Promise<DiagnosticStage> {
  const { result, ms } = await withTiming(async () => {
    const { getRedisConnection, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } =
      await import('@sitenexis/crawler');
    const raw = await getRedisConnection().get(HEARTBEAT_KEY);
    if (!raw) return { status: 'not_configured' as const, reason: 'No heartbeat key in Redis — no BullMQ worker has ever run. Expected when the serverless audit path is the only runner.' };
    const age = Date.now() - parseInt(raw, 10);
    const alive = age < HEARTBEAT_STALE_MS;
    return {
      status: alive ? 'ok' as const : 'error' as const,
      ageMs: age,
      staleThresholdMs: HEARTBEAT_STALE_MS,
      ...(alive ? {} : { reason: 'Heartbeat key exists but is stale — a worker was running recently and has stopped updating it' }),
    };
  }).catch((err) => ({
    result: {
      status: 'error' as const,
      reason: err instanceof Error ? err.message : String(err),
    },
    ms: 0,
  }));

  const r = result as { status: 'ok' | 'error' | 'not_configured'; reason?: string; ageMs?: number; staleThresholdMs?: number };

  return {
    stage: 'worker_heartbeat',
    status: r.status,
    latency_ms: ms,
    detail: r,
    ...(r.status === 'ok'
      ? {}
      : r.status === 'not_configured'
        ? {
            recommended_fix:
              'No worker detected — this is expected on the serverless-only deployment. If you intend to run the BullMQ worker (bulk/background processing), start it: pnpm --filter @sitenexis/crawler dev:worker. Otherwise no action is needed.',
          }
        : {
            error: r.reason ?? 'Worker heartbeat check failed',
            recommended_fix:
              'Could not read the worker heartbeat from Redis. If Redis itself is unreachable, see the redis_ping stage. If Redis is reachable but this still errors, a BullMQ worker may have crashed after previously running — check the worker process (Railway, Fly.io, or a VPS).',
          }),
  };
}
