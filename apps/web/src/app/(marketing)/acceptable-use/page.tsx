import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — SiteNexis',
  description: 'Rules governing acceptable use of the SiteNexis platform and API.',
  alternates: { canonical: '/acceptable-use' },
};

const SECTIONS = [
  {
    title: '1. Purpose',
    body: 'This Acceptable Use Policy expands on Section 4 of our Terms of Service. It exists to keep SiteNexis useful for genuine AI-visibility improvement work and to prevent the platform from being used to manipulate AI retrieval or recommendation systems — a principle central to how SiteNexis is built (see our Anti-Manipulation Principles on the Methodology page).',
  },
  {
    title: '2. Domains You Audit',
    body: 'You may only audit domains you own, operate, or have explicit written permission to audit. Competitive analysis features are for benchmarking your own visibility against named competitors, not for scraping competitor infrastructure at scale.',
  },
  {
    title: '3. Prohibited Uses',
    body: 'You must not use SiteNexis to: generate or publish synthetic entity signals, fabricated sameAs links, or fake authority networks; manufacture circular citation networks intended to deceive AI trust filtering; deploy hidden text or prompt-injection payloads aimed at AI crawlers; systematically resell or redistribute bulk audit data extracted via the API outside your plan\'s licensing terms; or attempt to reverse-engineer scoring logic for the specific purpose of gaming a score without improving the underlying content.',
  },
  {
    title: '4. API and Automation',
    body: 'API access (Agency/Enterprise plans) must respect published rate limits. Automated bulk-domain scanning must not be used to build a competing audit or scoring product without a commercial licensing agreement.',
  },
  {
    title: '5. Fair Use of Layer 4 Analysis',
    body: 'Machine Trust, Retrieval Simulation, Temporal Authority, Recommendation Surface Mapping, and Synthetic Entity Detection results are provided for the domain owner\'s own use. Synthetic Entity Detection findings in particular are shown only to the audited domain\'s owner and must not be used to make public accusations of fraud against third parties — these are probabilistic pattern signals, not definitive findings (see our Disclaimer).',
  },
  {
    title: '6. Enforcement',
    body: 'Violations may result in suspension or termination of your account, as described in Section 9 of our Terms of Service. We aim to communicate concerns before taking action wherever practical.',
  },
];

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Acceptable Use Policy</h1>
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
            Questions about this policy? Contact us at{' '}
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
