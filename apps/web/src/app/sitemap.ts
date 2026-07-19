import { type MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blog-posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sitenexis.vercel.app';

  // Previously a hand-maintained list of 8 URLs — silently missed every marketing
  // page added since and, critically, all 200+ blog posts (only linked via /blog's
  // own index and a same-category "related articles" widget, never via sitemap).
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/about`,                   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/login`,                   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`,                  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/reset-password`,          lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${base}/pricing`,                 lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/blog`,                    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/docs`,                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/platform`,                lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/mts`,                     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/ai-instructions`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/content-map`,             lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/tools/ai-scorer`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tools/citation-check`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tools/citation-checklist`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tools/quick-check`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => {
    const parsed = new Date(post.publishedAt);
    return {
      url: `${base}/blog/${post.slug}`,
      lastModified: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
      changeFrequency: 'monthly',
      priority: 0.7,
    };
  });

  return [...staticRoutes, ...blogRoutes];
}
