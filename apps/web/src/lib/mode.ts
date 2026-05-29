/**
 * Returns true when both Supabase auth AND the database are configured with
 * real (non-placeholder) credentials. When false, API routes fall back to
 * in-memory demo mode so the app stays functional during development.
 *
 * Also returns false when the DEMO_MODE env var is explicitly set to "true",
 * allowing a forced demo mode even with real credentials present.
 */
export function isFullyConfigured(): boolean {
  if (process.env['DEMO_MODE'] === 'true') return false;

  const supabaseUrl = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const dbUrl = process.env['DATABASE_URL'] ?? '';

  const supabaseOk = Boolean(supabaseUrl) && !supabaseUrl.includes('placeholder');
  const dbOk = Boolean(dbUrl) && !dbUrl.includes('placeholder');

  return supabaseOk && dbOk;
}
