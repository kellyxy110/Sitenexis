import { type MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sitenexis.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/audit/'],
      },
      // AI training and retrieval crawlers — explicit allow for brand visibility
      { userAgent: 'GPTBot',            allow: '/' },
      { userAgent: 'OAI-SearchBot',     allow: '/' },
      { userAgent: 'Google-Extended',   allow: '/' },
      { userAgent: 'PerplexityBot',     allow: '/' },
      { userAgent: 'ClaudeBot',         allow: '/' },
      { userAgent: 'anthropic-ai',      allow: '/' },
      { userAgent: 'CCBot',             allow: '/' },
      { userAgent: 'Diffbot',           allow: '/' },
      { userAgent: 'Bytespider',        allow: '/' },
      { userAgent: 'cohere-ai',         allow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
