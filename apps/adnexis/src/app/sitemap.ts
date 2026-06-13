import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://adnexis-eight.vercel.app';
  return [
    { url: base,                  lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/pricing`,     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/guide`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/login`,       lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${base}/signup`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.6 },
  ];
}
