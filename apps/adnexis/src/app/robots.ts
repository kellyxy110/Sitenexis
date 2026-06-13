import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://adnexis-eight.vercel.app';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api/', '/analyze', '/vault', '/generate'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
