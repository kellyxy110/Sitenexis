import { type MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sitenexis.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/login`,                   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`,                  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/pricing`,                 lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/blog`,                    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/ai-instructions`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/content-map`,             lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/tools/citation-checklist`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];

  return staticRoutes;
}
