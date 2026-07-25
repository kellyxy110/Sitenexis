import { type MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/lib/blog-posts';

const CANONICAL_BASE = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sitenexis.vercel.app';

/**
 * Static pages intentionally omit lastModified because the source does not
 * maintain truthful per-page modification timestamps. Claiming "now" on every
 * request creates a false freshness signal. Blog dates come from the content
 * manifest and are therefore safe to emit.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: CANONICAL_BASE, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${CANONICAL_BASE}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${CANONICAL_BASE}/founder`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${CANONICAL_BASE}/press`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${CANONICAL_BASE}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${CANONICAL_BASE}/blog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${CANONICAL_BASE}/docs`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${CANONICAL_BASE}/platform`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${CANONICAL_BASE}/methodology`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${CANONICAL_BASE}/changelog`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${CANONICAL_BASE}/mts`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${CANONICAL_BASE}/ai-instructions`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${CANONICAL_BASE}/content-map`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${CANONICAL_BASE}/sitemap-html`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${CANONICAL_BASE}/tools/ai-scorer`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${CANONICAL_BASE}/tools/citation-check`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${CANONICAL_BASE}/tools/citation-checklist`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${CANONICAL_BASE}/tools/quick-check`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${CANONICAL_BASE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${CANONICAL_BASE}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${CANONICAL_BASE}/cookie-policy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${CANONICAL_BASE}/disclaimer`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${CANONICAL_BASE}/acceptable-use`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${CANONICAL_BASE}/ai-disclosure`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${CANONICAL_BASE}/copyright`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${CANONICAL_BASE}/contact`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => {
    const parsed = new Date(post.publishedAt);
    return {
      url: `${CANONICAL_BASE}/blog/${post.slug}`,
      ...(Number.isNaN(parsed.getTime()) ? {} : { lastModified: parsed }),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    };
  });

  return [...staticRoutes, ...blogRoutes];
}
