import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Changelog — SiteNexis',
  description: 'SiteNexis product changelog — new features, improvements, and fixes.',
  alternates: { canonical: '/changelog' },
};

const RELEASES = [
  {
    version: 'v3.0',
    date: 'May 2025',
    tag: 'Major Release',
    tagColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    items: [
      { type: 'new', text: 'Machine Trust Layer — 5 new v3 analyzer modules (retrieval simulation, machine trust, temporal authority, recommendation surface mapping, synthetic entity detection)' },
      { type: 'new', text: 'SiteNexis Self-Audit — platform continuously monitors itself and displays live health scores' },
      { type: 'new', text: 'SiteNexis Health Score — 8-dimension composite score with public showcase at /platform/health' },
      { type: 'new', text: 'Recommendations Engine — every finding includes issue, impact, fix, and estimated improvement' },
      { type: 'new', text: 'Historical tracking — compare today / 7d / 30d / 90d across all dimensions' },
      { type: 'new', text: 'Deploy webhook — every deployment triggers an automatic full audit of sitenexis.vercel.app' },
      { type: 'improved', text: 'AI Visibility Score now uses 8-dimension weighted formula including GEO score' },
      { type: 'improved', text: 'All v3 agents implement graceful partial failure — sub-task errors never void the full run' },
    ],
  },
  {
    version: 'v2.0',
    date: 'April 2025',
    tag: 'Major Release',
    tagColor: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
    items: [
      { type: 'new', text: 'AI Perception Graph — models AI systems\' internal semantic representation of your site' },
      { type: 'new', text: 'Entity Intelligence Engine — entity detection, consistency, coverage, and disambiguation scoring' },
      { type: 'new', text: 'Citation Probability Engine — 7-factor weighted citation score per page and site-wide' },
      { type: 'new', text: 'Semantic Trust Layer — authorship, organisational, content, and structural trust signals' },
      { type: 'new', text: 'Machine Readability Score — 7-stage extraction pipeline analysis' },
      { type: 'new', text: 'Multi-provider AI behavior modeling — Google AI Overviews, ChatGPT, Perplexity, Claude, Gemini' },
      { type: 'improved', text: 'PDF report generator with all v2 scores and explainability breakdowns' },
    ],
  },
  {
    version: 'v1.0',
    date: 'March 2025',
    tag: 'Initial Release',
    tagColor: 'bg-white/10 text-slate-300 border-white/15',
    items: [
      { type: 'new', text: 'Core audit engine — Puppeteer crawl, Cheerio extraction, BullMQ job queue' },
      { type: 'new', text: 'SEO Health Score — 6-dimension technical SEO analysis with full explainability' },
      { type: 'new', text: 'Schema Intelligence — detection, validation, and auto-generated snippets' },
      { type: 'new', text: 'Link Graph analysis — PageRank, orphaned pages, cluster detection' },
      { type: 'new', text: 'Performance scoring — Lighthouse integration with Core Web Vitals' },
      { type: 'new', text: 'AI Readability Score — 4-dimension extractability analysis via Claude API' },
      { type: 'new', text: 'Supabase authentication, Stripe billing, and PDF report generation' },
    ],
  },
];

const TYPE_STYLES: Record<string, string> = {
  new:      'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  improved: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  fix:      'bg-amber-500/10 text-amber-400 border border-amber-500/20',
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Changelog</p>
        <h1 className="mt-3 mb-12 text-[36px] font-bold tracking-[-0.02em] text-white">What&apos;s new</h1>

        <div className="relative space-y-12">
          {/* Timeline line */}
          <div className="absolute left-0 top-2 bottom-2 w-px bg-white/[0.06]" />

          {RELEASES.map((release) => (
            <div key={release.version} className="pl-8 relative">
              {/* Dot */}
              <div className="absolute left-[-4px] top-1.5 h-2 w-2 rounded-full border border-white/20 bg-[#0A1628]" />

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-[22px] font-bold text-white">{release.version}</h2>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${release.tagColor}`}>
                  {release.tag}
                </span>
                <span className="text-[13px] text-slate-500">{release.date}</span>
              </div>

              <ul className="space-y-2.5">
                {release.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${TYPE_STYLES[item.type] ?? TYPE_STYLES.fix}`}>
                      {item.type}
                    </span>
                    <span className="text-[13px] leading-[1.65] text-slate-400">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
