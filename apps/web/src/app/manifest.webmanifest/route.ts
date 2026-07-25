export const dynamic = 'force-static';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitenexis.vercel.app';

export function GET(): Response {
  const manifest = {
    name: 'SiteNexis — AI Visibility Intelligence',
    short_name: 'SiteNexis',
    description: 'AI Retrieval and Machine Trust Intelligence platform.',
    start_url: `${base}/`,
    scope: '/',
    display: 'standalone',
    background_color: '#07111F',
    theme_color: '#07111F',
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
      { src: '/icon', sizes: '32x32', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
