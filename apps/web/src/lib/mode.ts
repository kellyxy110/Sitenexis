/**
 * Returns true when ALL required service credentials are configured with
 * real (non-placeholder) values. When false, API routes fall back to
 * in-memory demo mode so the app stays functional without credentials.
 *
 * Checks performed (env var presence only — no live connection tests):
 *   1. SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL — must be set, not placeholder
 *   2. DATABASE_URL — must be set, not placeholder
 *   3. REDIS_URL — must be set AND not be localhost (localhost = no Redis on Vercel)
 *   4. SUPABASE_ANON_KEY — must be set, not placeholder
 *
 * Set DEMO_MODE=true to force demo mode even with real credentials (e.g. staging).
 */
export function isFullyConfigured(): boolean {
  if (process.env['DEMO_MODE'] === 'true') return false;

  const supabaseUrl   = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const dbUrl         = process.env['DATABASE_URL'] ?? '';
  const supabaseAnon  = process.env['SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

  const supabaseOk = Boolean(supabaseUrl) && !supabaseUrl.includes('placeholder');
  const dbOk       = Boolean(dbUrl)       && !dbUrl.includes('placeholder');
  const anonOk     = Boolean(supabaseAnon) && !supabaseAnon.includes('placeholder');

  // Redis is NOT required here — the serverless audit path works without it.
  // Redis absence means background BullMQ jobs are unavailable, but audits still
  // run via the serverless path. Demo mode is only triggered when auth/DB is missing.
  return supabaseOk && dbOk && anonOk;
}

/**
 * Returns a structured breakdown of which services are configured.
 * Used by the health endpoint and dashboard to show actionable gaps.
 */
export function getConfigurationStatus(): {
  fullyConfigured: boolean;
  services: Record<string, { ok: boolean; reason?: string | undefined }>;
} {
  const supabaseUrl  = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const dbUrl        = process.env['DATABASE_URL'] ?? '';
  const redisUrl     = process.env['REDIS_URL'] ?? '';
  const supabaseAnon = process.env['SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

  const services = {
    supabase: {
      ok: Boolean(supabaseUrl) && !supabaseUrl.includes('placeholder'),
      reason: !supabaseUrl ? 'SUPABASE_URL not set' : supabaseUrl.includes('placeholder') ? 'SUPABASE_URL is placeholder' : undefined,
    },
    database: {
      ok: Boolean(dbUrl) && !dbUrl.includes('placeholder'),
      reason: !dbUrl ? 'DATABASE_URL not set' : dbUrl.includes('placeholder') ? 'DATABASE_URL is placeholder' : undefined,
    },
    redis: {
      ok: Boolean(redisUrl) && !redisUrl.includes('placeholder') && !redisUrl.includes('localhost') && !redisUrl.includes('127.0.0.1'),
      reason: !redisUrl
        ? 'REDIS_URL not set — set to an Upstash Redis URL on Vercel'
        : redisUrl.includes('placeholder')
        ? 'REDIS_URL is placeholder'
        : redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1')
        ? 'REDIS_URL is localhost — will not work on Vercel. Use Upstash Redis.'
        : undefined,
    },
    supabaseAnon: {
      ok: Boolean(supabaseAnon) && !supabaseAnon.includes('placeholder'),
      reason: !supabaseAnon ? 'SUPABASE_ANON_KEY not set' : supabaseAnon.includes('placeholder') ? 'SUPABASE_ANON_KEY is placeholder' : undefined,
    },
  };

  // Redis is optional — serverless audit works without it.
  const fullyConfigured =
    process.env['DEMO_MODE'] !== 'true' &&
    services.supabase.ok &&
    services.database.ok &&
    services.supabaseAnon.ok;

  return { fullyConfigured, services };
}
