import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const supabaseKey = process.env['SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
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
