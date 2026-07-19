import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Copyright — SiteNexis',
  description: 'Copyright ownership and permitted use of SiteNexis content, reports, and brand assets.',
  alternates: { canonical: '/copyright' },
};

const SECTIONS = [
  {
    title: 'Site Content',
    body: `© ${new Date().getFullYear()} SiteNexis. All rights reserved. All text, graphics, the SiteNexis logo mark, scoring methodology descriptions, and blog articles published on sitenexis.vercel.app are the property of SiteNexis unless otherwise credited.`,
  },
  {
    title: 'Audit Reports',
    body: 'PDF and in-dashboard audit reports generated for your account are yours to use for internal business purposes. Redistributing or reselling generated reports to third parties requires a white-label license (Agency/Enterprise plans) — see Section 7 of our Terms of Service.',
  },
  {
    title: 'Scoring Methodology and Software',
    body: 'The underlying scoring algorithms, agent architecture, and platform software are proprietary and not licensed for reuse, reverse-engineering, or incorporation into a competing product.',
  },
  {
    title: 'Blog Content Reuse',
    body: 'Short excerpts (up to ~50 words) from SiteNexis blog articles may be quoted with attribution and a link back to the original article. Full-article reproduction requires written permission — contact us using the email below.',
  },
  {
    title: 'Brand Assets',
    body: 'The SiteNexis name and logo mark may not be used to imply endorsement or partnership without permission. Approved brand assets for press and partner use are available on the Press page.',
  },
  {
    title: 'Reporting Infringement',
    body: 'If you believe content on SiteNexis infringes your copyright, contact us with a description of the material and its location on the site, and we will review it promptly.',
  },
];

export default function CopyrightPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Copyright</h1>
        <p className="mb-12 text-[14px] text-slate-500">Last updated: July 2026</p>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="mb-3 text-[17px] font-semibold text-white">{s.title}</h2>
              <p className="text-[14px] leading-[1.75] text-slate-400">{s.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-[14px] text-slate-400">
            Copyright questions or permission requests:{' '}
            <a href="mailto:sitenexisintel@gmail.com" className="text-cyan hover:underline">
              sitenexisintel@gmail.com
            </a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
