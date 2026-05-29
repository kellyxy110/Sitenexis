import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  // Accept 'next' (from OAuth) or fall back to '/dashboard'
  const rawNext = searchParams.get('next') ?? '/dashboard';
  // Ensure next is a relative path (prevent open redirect)
  const next = rawNext.startsWith('/') ? rawNext : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.error({ error: error.message }, '[auth/callback] exchangeCodeForSession error');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Ensure the user exists in the app's database after first sign-in.
  // Supabase creates auth.users automatically; we must create the public users row.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { upsertUser } = await import('@sitenexis/db');
      await upsertUser(user.id, user.email);
    }
  } catch (err) {
    // Non-fatal: log but don't block the redirect. The user can still access the
    // dashboard and the row will be created on their next authenticated API call.
    logger.warn({ err }, '[auth/callback] upsertUser failed — user may hit plan-limit errors');
  }

  return NextResponse.redirect(`${origin}${next}`);
}
