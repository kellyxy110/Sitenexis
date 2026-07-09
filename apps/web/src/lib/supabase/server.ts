import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  // Prefer the non-public vars; fall back to NEXT_PUBLIC_ when the non-public
  // var is missing or still holds a placeholder value from .env.example.
  const rawUrl = process.env['SUPABASE_URL'] ?? '';
  const rawKey = process.env['SUPABASE_ANON_KEY'] ?? '';
  const supabaseUrl = (rawUrl && !rawUrl.includes('placeholder'))
    ? rawUrl
    : (process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '');
  const supabaseKey = (rawKey && !rawKey.includes('placeholder'))
    ? rawKey
    : (process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '');
  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options !== undefined) {
              cookieStore.set(name, value, options);
            } else {
              cookieStore.set(name, value);
            }
          });
        },
      },
    }
  );
}
