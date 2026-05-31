/**
 * Next.js instrumentation — runs once at server startup before any route handler.
 * Sets PRISMA_QUERY_ENGINE_LIBRARY so PrismaClient can find the engine binary
 * in the Vercel monorepo deployment layout (/var/task/packages/db/generated/).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return; // already set (Vercel dashboard or env)

  const { join } = await import('path');
  const { existsSync } = await import('fs');

  const engines = [
    'libquery_engine-rhel-openssl-3.0.x.so.node',
    'libquery_engine-rhel-openssl-1.1.x.so.node',
    'libquery_engine-linux-musl-openssl-3.0.x.so.node',
  ];

  const dirs = [
    '/var/task/packages/db/generated',                          // Vercel runtime
    '/vercel/path0/packages/db/generated',                      // Vercel build
    join(process.cwd(), '../../packages/db/generated'),         // monorepo from apps/web
    join(process.cwd(), '../packages/db/generated'),
    join(process.cwd(), 'packages/db/generated'),
  ];

  for (const dir of dirs) {
    for (const engine of engines) {
      const p = join(dir, engine);
      if (existsSync(p)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = p;
        return;
      }
    }
  }
}
