import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard';
  const next = rawNext.startsWith('/') ? rawNext : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { upsertUser } = await import('@sitenexis/db');
      await upsertUser(user.id, user.email);
    }
  } catch {
    // Non-fatal: DB row will be created on first authenticated API call
  }

  return NextResponse.redirect(`${origin}${next}`);
}
