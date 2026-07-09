import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

const PROTECTED_PATHS = ['/dashboard', '/audit', '/api/audit', '/api/audits', '/api/usage'];

// Public paths that never need auth checks (avoids unnecessary Supabase calls)
const PUBLIC_PATHS = [
  '/', '/login', '/signup', '/auth', '/reset-password', '/blog',
  '/platform', '/docs', '/pricing', '/about', '/privacy', '/terms', '/changelog', '/status',
  '/api/health', '/api/webhooks', '/api/quick-audit', '/api/demo',
];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // Auth-bypass flags are only honoured in non-production environments.
  // In production, PLAYWRIGHT_TEST and DEMO_MODE are ignored even if set,
  // preventing accidental open-access deployments.
  const isProduction = process.env['VERCEL_ENV'] === 'production' || process.env['NODE_ENV'] === 'production';
  if (!isProduction) {
    if (process.env['PLAYWRIGHT_TEST'] === 'true') return NextResponse.next();
    if (process.env['DEMO_MODE'] === 'true') return NextResponse.next();
  }

  const { pathname, searchParams } = req.nextUrl;

  // Skip middleware entirely for static assets and public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow demo audit pages through without auth
  if (pathname.startsWith('/audit/') && searchParams.get('demo') === 'true') {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  let res = NextResponse.next({ request: req });

  // NEXT_PUBLIC_ vars are embedded at build time and reliably available in the
  // Edge runtime. Non-public vars like DATABASE_URL are not guaranteed here.
  const supabaseUrl  = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const supabaseKey  = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

  // If Supabase isn't configured, allow all requests through — API routes will
  // return demo data. Only NEXT_PUBLIC_ vars are checked here (edge-safe).
  if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey === 'placeholder') {
    return NextResponse.next();
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }>) => {
        // Update all request cookies first, then create one new response so every
        // cookie survives (creating a new NextResponse.next inside the loop loses
        // cookies from previous iterations).
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => {
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
