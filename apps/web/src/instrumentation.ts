/**
 * Next.js instrumentation — runs once at server startup before any route handler.
 * Sets PRISMA_QUERY_ENGINE_LIBRARY so PrismaClient can find the engine binary
 * in the Vercel monorepo deployment layout (/var/task/packages/db/generated/).
 *
 * Uses webpackIgnore to prevent bundler from trying to resolve path/fs as npm modules.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  await registerPrismaEngine();
  await registerAiTelemetrySubscriber();
}

async function registerPrismaEngine() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;

  // Vercel deploys the monorepo under /var/task — the Linux engine is always there.
  // Setting it here before any route handler runs ensures PrismaClient finds the engine.
  const vercelPath =
    '/var/task/packages/db/generated/libquery_engine-rhel-openssl-3.0.x.so.node';

  // Engine filenames in preference order for the CURRENT platform. On Windows the
  // committed Linux .so.node binaries are present in the repo too, so we must select
  // the Windows dll FIRST — otherwise require() pins an incompatible Linux engine and
  // every query fails with "Prisma engines do not seem to be compatible with your system".
  // Mirrors @sitenexis/db's orderEnginesForPlatform (kept inline to avoid importing the
  // Prisma client at instrumentation time); the ordering invariant is regression-tested
  // in packages/db/src/engine-select.test.ts.
  const engineOrder =
    process.platform === 'win32'
      ? ['query_engine-windows.dll.node',
         'libquery_engine-rhel-openssl-3.0.x.so.node',
         'libquery_engine-rhel-openssl-1.1.x.so.node']
      : ['libquery_engine-rhel-openssl-3.0.x.so.node',
         'libquery_engine-rhel-openssl-1.1.x.so.node',
         'query_engine-windows.dll.node'];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');

    // Directories where the generated engines may live, most-specific first.
    const dirs = [
      '/var/task/packages/db/generated',
      path.join(process.cwd(), '../../packages/db/generated'), // apps/web → repo root
      path.join(process.cwd(), 'packages/db/generated'),
    ];

    // Engine-outer, dir-inner: pick the platform-appropriate engine wherever it exists
    // before falling back to a less-appropriate one.
    for (const engine of engineOrder) {
      for (const dir of dirs) {
        const p = path.join(dir, engine);
        if (fs.existsSync(p)) {
          process.env.PRISMA_QUERY_ENGINE_LIBRARY = p;
          return;
        }
      }
    }
  } catch {
    // fs/path unavailable — fall back to known Vercel path unconditionally
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = vercelPath;
  }
}

/**
 * Persists AI call events emitted by packages/analyzers/src/ai/client.ts (the
 * BullMQ-pipeline call path). packages/analyzers must never import @sitenexis/db
 * directly (CLAUDE.md §7), so this is the one place that bridges the DB-free
 * emitter to real storage. Registered once per server instance at startup —
 * safe to no-op if analyzers isn't installed in this deployment for any reason.
 */
async function registerAiTelemetrySubscriber() {
  try {
    const [{ onAiCall }, { recordAiCallMetric }] = await Promise.all([
      import('@sitenexis/analyzers'),
      import('@sitenexis/db'),
    ]);
    onAiCall((event: import('@sitenexis/analyzers').AiCallEvent) => {
      void recordAiCallMetric({ ...event, skillId: null }).catch(() => {});
    });
  } catch {
    // Telemetry subscription failing must never block server startup.
  }
}
