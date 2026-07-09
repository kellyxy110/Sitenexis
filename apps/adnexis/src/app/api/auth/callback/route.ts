// OAuth callbacks are handled by NextAuth at /api/auth/[...nextauth]
// This route redirects legacy Supabase callback URLs to dashboard
import { type NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest): NextResponse {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
