import { type MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blog-posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sitenexis.vercel.app';

  // Previously a hand-maintained list of 8 URLs — silently missed every marketing
  // page added since and, critically, all 200+ blog posts (only linked via /blog's
  // own index and a same-category "related articles" widget, never via sitemap).
  // Auth pages (/login, /signup, /reset-password) are intentionally excluded —
  // they carry noindex and have no ranking value; listing them in the sitemap
  // while blocking indexing sends crawlers a contradictory signal.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/about`,                   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/founder`,                 lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/press`,                   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/pricing`,                 lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/blog`,                    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/docs`,                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/platform`,                lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/methodology`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/changelog`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${base}/mts`,                     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/ai-instructions`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/content-map`,             lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/sitemap-html`,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.4 },
    { url: `${base}/tools/ai-scorer`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tools/citation-check`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tools/citation-checklist`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/tools/quick-check`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`,                 lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,                   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/cookie-policy`,           lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/disclaimer`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/acceptable-use`,          lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/ai-disclosure`,           lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/copyright`,               lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${base}/contact`,                 lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
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
