import { BLOG_POSTS } from '@/lib/blog-posts';

export const dynamic = 'force-static';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitenexis.vercel.app';

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function GET(): Response {
  const items = BLOG_POSTS.map((post) => {
    const date = new Date(post.publishedAt);
    if (Number.isNaN(date.getTime())) return '';
    const published = date;
    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${base}/blog/${post.slug}</link>
      <guid isPermaLink="true">${base}/blog/${post.slug}</guid>
      <pubDate>${published.toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SiteNexis Blog</title>
    <link>${base}/blog</link>
    <description>AI visibility, machine trust, entity optimization, and the machine-first web.</description>
    <language>en</language>
    <copyright>SiteNexis</copyright>${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } });
}
