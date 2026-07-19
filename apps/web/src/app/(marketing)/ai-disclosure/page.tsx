import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'AI Data Processing & Usage Disclosure — SiteNexis',
  description: 'How SiteNexis uses AI models (Anthropic Claude, and optionally OpenAI) to process your audit data.',
  alternates: { canonical: '/ai-disclosure' },
};

const SECTIONS = [
  {
    title: 'Why SiteNexis Uses AI Models',
    body: [
      'SiteNexis is a platform for modeling how AI systems retrieve, interpret, and trust web content — parts of that modeling genuinely require AI inference, not just rule-based scoring.',
      'AI models are used for: AI Extractability scoring (readability.ts), entity extraction and disambiguation, cross-page contradiction detection (Semantic Trust and Machine Trust layers), and Intelligence Report narrative generation.',
      'Purely programmatic checks — SEO signals, schema validation, robots.txt/sitemap analysis, and most of the Retrieval Simulation Engine — do NOT use AI models. They run deterministic, rule-based logic. See the Methodology page for which score belongs to which category.',
    ],
  },
  {
    title: 'Which Providers Process Your Data',
    body: [
      'Anthropic (Claude API) is the primary AI provider. Audit content you submit (page text, extracted entities, schema markup) may be sent to Anthropic\'s API for analysis, subject to Anthropic\'s API terms and data-handling policies.',
      'OpenAI is used only as a fallback if the primary provider is unavailable, under the same content-handling constraints.',
      'AI providers are used strictly as data processors, executing analysis you\'ve requested — not to train their models on your content by default, per each provider\'s API-tier data usage terms.',
    ],
  },
  {
    title: 'What Is and Is Not Sent',
    body: [
      'Sent: publicly crawlable page text, extracted schema markup, and entity/relationship data from domains you submit for audit.',
      'Not sent: your account password, payment details (handled entirely by Stripe), or private dashboard data unrelated to the specific audit being processed.',
      'AI calls are capped (e.g. a 2000-token content cap per page) and cached by content hash for 7–48 hours depending on the analysis type, to avoid redundant processing of unchanged content.',
    ],
  },
  {
    title: 'Estimates, Not Ground Truth',
    body: [
      'AI-derived scores (entity confidence, semantic trust, contradiction detection) are labeled as model-based estimates throughout the product — never presented as certain facts about your site or about how any external AI system actually behaves.',
      'See our Disclaimer page for the full scope of what SiteNexis scores do and do not guarantee.',
    ],
  },
  {
    title: 'Your Controls',
    body: [
      'You control what gets audited — SiteNexis only processes domains you explicitly submit.',
      'You may delete your account and all associated audit data, including any cached AI analysis, from Account Settings at any time (see Privacy Policy).',
    ],
  },
];

export default function AIDisclosurePage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">AI Data Processing &amp; Usage Disclosure</h1>
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
            Questions about how we use AI models? Contact us at{' '}
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
