import { type MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://sitenexis.vercel.app';
  const privatePaths = ['/dashboard/', '/api/', '/audit/', '/auth/'];
  const aiAndSearchCrawlers = [
    'Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
    'ClaudeBot', 'Claude-SearchBot', 'anthropic-ai', 'Google-Extended',
    'PerplexityBot', 'Applebot', 'Applebot-Extended', 'CCBot', 'Diffbot',
    'Bytespider', 'cohere-ai', 'MistralAI', 'Amazonbot', 'Meta-ExternalAgent',
  ];
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
      // Explicit groups do not inherit the wildcard group. Repeat private-path
      // exclusions so named AI/search crawlers cannot reach private surfaces.
      { userAgent: aiAndSearchCrawlers, allow: '/', disallow: privatePaths },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
