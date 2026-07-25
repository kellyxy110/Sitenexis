import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

/** Keep the conventional browser favicon URL compatible with the SVG asset. */
export function GET(request: Request): Response {
  return NextResponse.redirect(new URL('/favicon.svg', request.url), 308);
}
