import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Cookie Policy — SiteNexis',
  description: 'How SiteNexis uses cookies and similar technologies, and how to control them.',
  alternates: { canonical: '/cookie-policy' },
};

const SECTIONS = [
  {
    title: 'What Cookies We Use',
    body: [
      'Essential session cookies: required to keep you signed in and to protect your account (authentication tokens issued by Supabase Auth).',
      'CSRF/security cookies: used to protect forms and API requests from cross-site request forgery.',
      'SiteNexis does not set advertising cookies and does not load third-party ad-tracking scripts.',
      'SiteNexis does not use third-party analytics cookies that track you across other websites.',
    ],
  },
  {
    title: 'Why We Use Them',
    body: [
      'To keep you logged in between page loads and after closing your browser (persistent session).',
      'To remember plan/tier state so the correct dashboard features are shown.',
      'To protect authenticated actions (billing, API keys, team invites) from forgery.',
    ],
  },
  {
    title: 'Cookies We Do Not Use',
    body: [
      'No third-party advertising or retargeting cookies.',
      'No cross-site tracking pixels.',
      'No social-media "like/share" tracking widgets.',
    ],
  },
  {
    title: 'Managing Cookies',
    body: [
      'Essential cookies cannot be disabled without breaking sign-in — if you block them, you will not be able to use the dashboard.',
      'You can clear cookies at any time from your browser settings, which will sign you out of SiteNexis.',
      'Because SiteNexis does not use non-essential cookies, there is no cookie-preferences banner or opt-out toggle required — the only cookies set are the ones needed to run the service you signed up for.',
    ],
  },
  {
    title: 'Related Policies',
    body: [
      'This Cookie Policy should be read alongside our Privacy Policy, which covers how account and audit data is stored and used.',
    ],
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Cookie Policy</h1>
        <p className="mb-12 text-[14px] text-slate-500">Last updated: July 2026</p>
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
