import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

const PROTECTED_PATHS = ['/dashboard', '/vault', '/analyze', '/generate', '/api/ads', '/api/generate', '/api/hooks'];
const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth', '/api/health', '/guide', '/pricing'];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  let res = NextResponse.next({ request: req });

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const supabaseKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

  if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey === 'placeholder') {
    return NextResponse.next();
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          if (options !== undefined) {
            res.cookies.set(name, value, options);
          } else {
            res.cookies.set(name, value);
          }
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)'],
};
