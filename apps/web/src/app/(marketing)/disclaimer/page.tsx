import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Disclaimer — SiteNexis',
  description: 'What SiteNexis scores and simulations do and do not guarantee.',
  alternates: { canonical: '/disclaimer' },
};

const SECTIONS = [
  {
    title: 'Estimates, Not Guarantees',
    body: [
      'Every score, probability, and simulation SiteNexis produces — AI Visibility, Machine Trust, Citation Probability, Recommendation Surface coverage, and all others — is a modeled estimate derived from measurable content signals, not a live measurement of any AI system\'s internal behavior.',
      'SiteNexis does not query live AI retrieval systems to generate these scores. Retrieval Simulation and Recommendation Surface Mapping are algorithmic, reproducible approximations, not observed outcomes.',
      'No score, recommendation, or roadmap item guarantees a specific ranking, citation, or outcome in any AI system, search engine, or recommendation surface.',
    ],
  },
  {
    title: 'No Professional Advice',
    body: [
      'Content on this site (including blog articles, the Methodology page, and in-product recommendations) is provided for general informational purposes and does not constitute legal, financial, or professional advice.',
      'Decisions about your business, marketing spend, or legal compliance should be made in consultation with a qualified professional where appropriate.',
    ],
  },
  {
    title: 'Third-Party AI Systems',
    body: [
      'References to ChatGPT, Gemini, Perplexity, Claude, Google AI Overviews, and other AI systems describe publicly observable behavior patterns and provider documentation at the time of writing. These systems change frequently and without notice; SiteNexis is not affiliated with, and does not speak on behalf of, any of these providers.',
      'Provider-specific behavior weights used in scoring are configurable estimates, reviewed periodically, and are explicitly labeled as such throughout the product.',
    ],
  },
  {
    title: 'Accuracy of Audit Data',
    body: [
      'SiteNexis crawls and analyzes publicly accessible pages of the domain you submit. Pages blocked by robots.txt, requiring authentication, or unreachable at crawl time will not be reflected in your results.',
      'We make reasonable efforts to keep scoring logic accurate and explainable, but we do not warrant that any audit is complete, error-free, or perfectly reflects the live state of your site at every moment.',
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Disclaimer</h1>
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
            Questions about this disclaimer? Contact us at{' '}
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
