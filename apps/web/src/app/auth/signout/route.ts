import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isFullyConfigured } from '@/lib/mode';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = new URL(req.url).origin;

  if (isFullyConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(`${origin}/`);
}

// Support POST as well (form-based signout)
export { GET as POST };
