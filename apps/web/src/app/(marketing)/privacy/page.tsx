import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';

export const metadata: Metadata = {
  title: 'Privacy Policy — SiteNexis',
  description: 'SiteNexis privacy policy — how we collect, use, and protect your data.',
  alternates: { canonical: '/privacy' },
};

const SECTIONS = [
  {
    title: 'Information We Collect',
    body: [
      'Account information: email address and name when you create an account.',
      'Domain audit data: URLs, page content metadata, scores, and issues generated during audits you initiate.',
      'Usage data: audit history, feature usage, and session information for improving the service.',
      'Payment information: billing details processed securely through Stripe. SiteNexis does not store card numbers.',
    ],
  },
  {
    title: 'How We Use Your Information',
    body: [
      'To provide the SiteNexis audit and intelligence service.',
      'To generate AI visibility scores, entity analysis, and machine trust reports for domains you submit.',
      'To send transactional emails about your account (audit completions, billing, security).',
      'To improve the accuracy of our scoring models using aggregated, anonymised data.',
      'We do not sell your personal data to third parties.',
    ],
  },
  {
    title: 'Data Storage and Security',
    body: [
      'All data is stored on Supabase (PostgreSQL) hosted in the EU-West region.',
      'Audit data is retained for 90 days on free plans, 12 months on paid plans.',
      'All data in transit is encrypted with TLS 1.2+. Data at rest is encrypted by the cloud provider.',
      'API keys are stored as bcrypt hashes. We cannot recover a lost API key.',
      'You may delete your account and all associated data at any time from Account Settings.',
    ],
  },
  {
    title: 'Third-Party Services',
    body: [
      'Stripe: payment processing. Subject to Stripe\'s privacy policy.',
      'Anthropic (Claude API): used for AI-powered content analysis. Audit content is sent to Anthropic per their API terms.',
      'Supabase: database and authentication hosting.',
      'Upstash Redis: queue and caching infrastructure.',
      'Cloudflare R2: PDF report storage.',
    ],
  },
  {
    title: 'Your Rights',
    body: [
      'Access: you may request a copy of all personal data we hold about you.',
      'Correction: you may correct inaccurate personal data through Account Settings.',
      'Deletion: you may delete your account and all associated data at any time.',
      'Portability: you may export your audit history in JSON format from Account Settings.',
      'To exercise these rights, contact privacy@sitenexis.com.',
    ],
  },
  {
    title: 'Cookies',
    body: [
      'SiteNexis uses only essential session cookies required for authentication.',
      'We do not use advertising cookies or third-party tracking scripts.',
      'Analytics are collected using aggregated, anonymised session data without third-party tracking.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Privacy Policy</h1>
        <p className="mb-12 text-[14px] text-slate-500">Last updated: May 2025</p>
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="mb-4 text-[18px] font-semibold text-white">{s.title}</h2>
              <ul className="space-y-2.5">
                {s.body.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.7] text-slate-400">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-[14px] text-slate-400">
            Questions about this policy? Contact us at{' '}
            <a href="mailto:privacy@sitenexis.com" className="text-cyan hover:underline">
              privacy@sitenexis.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
