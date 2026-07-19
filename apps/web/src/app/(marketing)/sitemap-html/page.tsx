import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';
import { BLOG_POSTS } from '@/lib/blog-posts';

export const metadata: Metadata = {
  title: 'Sitemap — SiteNexis',
  description: 'Every page on SiteNexis, organized by section.',
  alternates: { canonical: '/sitemap-html' },
};

const SECTIONS: { heading: string; links: [string, string][] }[] = [
  {
    heading: 'Product',
    links: [
      ['Home', '/'],
      ['Platform', '/platform'],
      ['Pricing', '/pricing'],
      ['Methodology', '/methodology'],
      ['Changelog', '/changelog'],
      ['Docs', '/docs'],
      ['Machine Trust Score Lookup', '/mts'],
    ],
  },
  {
    heading: 'Free Tools',
    links: [
      ['AI Visibility Scorer', '/tools/ai-scorer'],
      ['Citation Check', '/tools/citation-check'],
      ['Citation Readiness Checklist', '/tools/citation-checklist'],
      ['Quick Check', '/tools/quick-check'],
    ],
  },
  {
    heading: 'Content',
    links: [
      ['Blog', '/blog'],
      ['Knowledge Graph / Content Map', '/content-map'],
      ['AI Instructions', '/ai-instructions'],
    ],
  },
  {
    heading: 'Company',
    links: [
      ['About SiteNexis', '/about'],
      ['Founder', '/founder'],
      ['Press & Media', '/press'],
      ['Contact', '/contact'],
    ],
  },
  {
    heading: 'Account',
    links: [
      ['Log in', '/login'],
      ['Sign up', '/signup'],
    ],
  },
  {
    heading: 'Legal',
    links: [
      ['Privacy Policy', '/privacy'],
      ['Terms of Service', '/terms'],
      ['Cookie Policy', '/cookie-policy'],
      ['Acceptable Use Policy', '/acceptable-use'],
      ['AI Data Disclosure', '/ai-disclosure'],
      ['Disclaimer', '/disclaimer'],
      ['Copyright', '/copyright'],
    ],
  },
];

export default function HtmlSitemapPage() {
  const blogByCategory = new Map<string, { slug: string; title: string }[]>();
  for (const post of BLOG_POSTS) {
    const list = blogByCategory.get(post.category) ?? [];
    list.push({ slug: post.slug, title: post.title });
    blogByCategory.set(post.category, list);
  }

  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Sitemap</h1>
        <p className="mb-12 text-[14px] text-slate-500">
          Every page on SiteNexis, organized by section. {BLOG_POSTS.length} blog articles listed by topic below.
        </p>

        <div className="grid gap-10 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-teal-400">{s.heading}</h2>
              <ul className="space-y-2.5">
                {s.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-[14px] text-slate-400 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="mb-6 text-[13px] font-semibold uppercase tracking-widest text-teal-400">Blog — {BLOG_POSTS.length} Articles</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {[...blogByCategory.entries()].map(([category, posts]) => (
              <div key={category}>
                <p className="mb-3 text-[12px] font-semibold text-slate-500">{category}</p>
                <ul className="space-y-2">
                  {posts.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/blog/${p.slug}`} className="text-[13px] leading-snug text-slate-500 transition-colors hover:text-slate-300">
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
