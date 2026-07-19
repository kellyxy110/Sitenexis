import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';
import { Mail, MessageSquare, Briefcase } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact SiteNexis',
  description: 'Get in touch with the SiteNexis team for support, sales, or media inquiries.',
  alternates: { canonical: '/contact' },
};

const CHANNELS = [
  {
    icon: MessageSquare,
    title: 'Support',
    body: 'Questions about your audit, dashboard, or account.',
    email: 'sitenexisintel@gmail.com',
  },
  {
    icon: Briefcase,
    title: 'Sales & Enterprise',
    body: 'Agency/Enterprise plans, white-label licensing, API access.',
    email: 'sitenexisintel@gmail.com',
  },
  {
    icon: Mail,
    title: 'Press & Media',
    body: 'Interview requests, brand assets, or company information.',
    email: 'sitenexisintel@gmail.com',
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Contact Us</h1>
        <p className="mb-12 text-[15px] leading-relaxed text-slate-400">
          SiteNexis is built and operated by a small team. Every message is read — expect a reply within
          1–2 business days.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((c) => (
            <a
              key={c.title}
              href={`mailto:${c.email}`}
              className="group flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-teal-500/25 hover:bg-white/[0.03]"
            >
              <c.icon size={18} className="text-teal-400" />
              <div>
                <p className="text-[14px] font-semibold text-white">{c.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{c.body}</p>
              </div>
              <span className="mt-auto text-[13px] text-cyan group-hover:underline">{c.email}</span>
            </a>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-[14px] leading-relaxed text-slate-400">
            Looking for the company story or founder background instead? See{' '}
            <Link href="/about" className="text-cyan hover:underline">About SiteNexis</Link>,{' '}
            <Link href="/founder" className="text-cyan hover:underline">the founder</Link>, or{' '}
            <Link href="/press" className="text-cyan hover:underline">Press &amp; Media</Link>.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
