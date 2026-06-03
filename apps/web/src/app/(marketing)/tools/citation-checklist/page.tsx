'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

// ── Checklist data (mirrors Citation Probability Score formula) ───────────────

type CheckItem = {
  id: string;
  label: string;
  description: string;
  points: number;
};

type CheckSection = {
  id: string;
  title: string;
  weight: string;
  formulaWeight: number;
  color: string;
  items: CheckItem[];
};

const SECTIONS: CheckSection[] = [
  {
    id: 'factual_density',
    title: 'Factual Density',
    weight: '20%',
    formulaWeight: 20,
    color: 'cyan',
    items: [
      { id: 'fd1', label: 'At least 3 specific, verifiable claims per 500 words', description: 'Examples: named statistics, dates, version numbers, quantified outcomes. Generalisations ("many businesses") do not count.', points: 7 },
      { id: 'fd2', label: 'Facts are attributed to a named source or primary entity', description: 'Unattributed claims score zero in AI citation systems. "Studies show" without a named study is not a citable claim.', points: 7 },
      { id: 'fd3', label: 'No factual claims contradicted by other pages on your domain', description: 'Cross-page contradictions suppress citation probability for the entire domain, not just the contradicting page.', points: 6 },
    ],
  },
  {
    id: 'claim_specificity',
    title: 'Claim Specificity',
    weight: '15%',
    formulaWeight: 15,
    color: 'teal',
    items: [
      { id: 'cs1', label: 'Claims use precise language, not approximations', description: '"Response time under 200ms" > "fast response time". AI systems prefer exact values over qualitative descriptions.', points: 5 },
      { id: 'cs2', label: 'Each key claim is answerable with a single sentence', description: 'Claims that require multi-paragraph context to evaluate are fragile under AI summarisation compression.', points: 5 },
      { id: 'cs3', label: 'Comparative claims name both entities being compared', description: '"X is faster than Y at task Z" is citable. "X is faster" is not — no comparison anchor.', points: 5 },
    ],
  },
  {
    id: 'entity_authority',
    title: 'Primary Entity Authority',
    weight: '15%',
    formulaWeight: 15,
    color: 'purple',
    items: [
      { id: 'ea1', label: 'Primary entity is named and defined within the first 100 words', description: 'AI systems extract entity definitions from early page content. Burying entity definition below the fold reduces citation probability.', points: 5 },
      { id: 'ea2', label: 'sameAs links present to Wikipedia, Wikidata, or industry directories', description: 'External validation of entity identity. A single high-quality sameAs link increases entity credibility score by 15–25 points.', points: 5 },
      { id: 'ea3', label: 'Entity name and description consistent across all pages on domain', description: 'Entity inconsistency (different name variants, conflicting descriptions) is a machine trust penalty applied domain-wide.', points: 5 },
    ],
  },
  {
    id: 'topical_authority',
    title: 'Topical Authority Depth',
    weight: '15%',
    formulaWeight: 15,
    color: 'violet',
    items: [
      { id: 'ta1', label: 'Page is part of a coherent topic cluster with at least 3 related posts', description: 'Isolated content on a topic cluster has lower citation probability than content that is part of a documented cluster of related content.', points: 5 },
      { id: 'ta2', label: 'Internal links use descriptive anchor text (not "click here" or "read more")', description: 'Descriptive anchor text reinforces entity relationships for AI systems traversing your content graph.', points: 5 },
      { id: 'ta3', label: 'Content covers a specific sub-topic completely rather than a broad topic partially', description: 'AI systems prefer depth over breadth for individual citation candidates. A complete answer to a narrow question beats a partial answer to a broad question.', points: 5 },
    ],
  },
  {
    id: 'structural_readiness',
    title: 'Structural Citation Readiness',
    weight: '15%',
    formulaWeight: 15,
    color: 'blue',
    items: [
      { id: 'sr1', label: 'H1 matches the primary question or comparison this page answers', description: 'AI systems use H1 as a query-answer alignment signal. "How X Works" aligns with "how does X work" queries. Generic H1s misalign.', points: 5 },
      { id: 'sr2', label: 'Each H2 section is a standalone answer unit — understandable without reading other sections', description: 'AI extraction operates at chunk level. Sections that depend on previous sections for context degrade in the extraction pipeline.', points: 5 },
      { id: 'sr3', label: 'FAQ or direct-answer section present for primary query', description: 'FAQ-structured content directly maps to AI Overview eligibility patterns and voice assistant retrieval requirements.', points: 5 },
    ],
  },
  {
    id: 'temporal_freshness',
    title: 'Temporal Freshness',
    weight: '10%',
    formulaWeight: 10,
    color: 'amber',
    items: [
      { id: 'tf1', label: 'dateModified schema present and reflects actual last update', description: 'AI systems apply trust decay to content without update signals. dateModified halts or slows this decay for eligible content.', points: 4 },
      { id: 'tf2', label: 'Time-sensitive claims (statistics, versions, dates) are less than 12 months old', description: 'Claims containing years, version numbers, or statistics older than 12 months trigger freshness penalties on recency-weighted queries.', points: 3 },
      { id: 'tf3', label: 'Content is published or updated within the last 180 days', description: 'For knowledge-domain content, 180+ days without update signals creates measurable decay in AI citation probability.', points: 3 },
    ],
  },
  {
    id: 'trust_signals',
    title: 'Trust Signal Density',
    weight: '10%',
    formulaWeight: 10,
    color: 'teal',
    items: [
      { id: 'ts1', label: 'Schema markup present and matches content type accurately', description: 'Article, HowTo, FAQPage, or Product schema — correct type for correct content. Wrong schema type is a trust penalty.', points: 4 },
      { id: 'ts2', label: 'Author entity present with credentials or verifiable external presence', description: 'Person schema with author name, role, and sameAs link to a professional profile (LinkedIn, Google Scholar, etc.).', points: 3 },
      { id: 'ts3', label: 'No promotional or marketing language in the main content body', description: '"Industry-leading", "revolutionary", "best-in-class" — promotional language suppresses citation probability. Write as a primary source, not a marketer.', points: 3 },
    ],
  },
] satisfies CheckSection[];

const MAX_SCORE = SECTIONS.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.points, 0), 0);

// ── Score display helpers ─────────────────────────────────────────────────────

function getScoreLabel(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 85) return { label: 'Citation-Ready', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
  if (pct >= 65) return { label: 'Needs Refinement', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  if (pct >= 40) return { label: 'Significant Gaps', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
  return { label: 'Not Citation-Ready', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
}

const SECTION_COLORS: Record<string, string> = {
  cyan:   'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  teal:   'text-teal-400 bg-teal-500/10 border-teal-500/20',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  blue:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  amber:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CitationChecklistPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, true]))
  );

  const toggle = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleSection = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const score = useMemo(() =>
    SECTIONS.reduce((total, section) =>
      total + section.items.reduce((st, item) =>
        st + (checked[item.id] ? item.points : 0), 0), 0),
    [checked]
  );

  const pct = Math.round((score / MAX_SCORE) * 100);
  const status = getScoreLabel(score, MAX_SCORE);

  const sectionScores = useMemo(() =>
    Object.fromEntries(SECTIONS.map(s => [
      s.id,
      {
        score: s.items.reduce((t, i) => t + (checked[i.id] ? i.points : 0), 0),
        max: s.items.reduce((t, i) => t + i.points, 0),
      }
    ])),
    [checked]
  );

  return (
    <main className="min-h-screen bg-[#0A1628] text-slate-200">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-12 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="mb-4 inline-block rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            Pre-Publish Tool
          </span>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-white">
            AI Citation Checklist
          </h1>
          <p className="text-lg leading-relaxed text-slate-400">
            Score your content against the 7 factors that determine AI citation probability.
            Based on the SiteNexis Citation Probability formula — the same model used in every audit.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

          {/* Checklist */}
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const ss = sectionScores[section.id];
              const sectionPct = Math.round((ss.score / ss.max) * 100);
              const colorClasses = (section as { color?: string }).color
                ? SECTION_COLORS[(section as { color?: string }).color!] ?? SECTION_COLORS.cyan
                : SECTION_COLORS.cyan;
              const isOpen = expanded[section.id];

              return (
                <div
                  key={section.id}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden"
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${colorClasses}`}>
                        {section.weight}
                      </span>
                      <span className="font-semibold text-white">{section.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-slate-500">
                        {ss.score}/{ss.max}
                        <span className="ml-1.5 text-[11px]">({sectionPct}%)</span>
                      </span>
                      {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </div>
                  </button>

                  {/* Progress bar */}
                  <div className="h-0.5 bg-white/[0.04] mx-6">
                    <div
                      className="h-full bg-cyan-500/60 transition-all duration-300"
                      style={{ width: `${sectionPct}%` }}
                    />
                  </div>

                  {/* Items */}
                  {isOpen && (
                    <div className="divide-y divide-white/[0.04]">
                      {section.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                        >
                          <button
                            role="checkbox"
                            aria-checked={!!checked[item.id]}
                            onClick={() => toggle(item.id)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all ${
                              checked[item.id]
                                ? 'border-cyan-500 bg-cyan-500'
                                : 'border-white/20 bg-transparent hover:border-white/40'
                            }`}
                          >
                            {checked[item.id] && <Check size={12} strokeWidth={3} className="text-[#0A1628]" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium leading-snug ${checked[item.id] ? 'text-slate-400 line-through decoration-white/20' : 'text-slate-200'}`}>
                              {item.label}
                            </div>
                            <div className="mt-1 text-[12px] leading-relaxed text-slate-500">
                              {item.description}
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-mono text-slate-600">
                            +{item.points}pt
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Score panel — sticky */}
          <div className="lg:sticky lg:top-6 space-y-4 self-start">
            {/* Score card */}
            <div className={`rounded-2xl border p-6 ${status.border} ${status.bg}`}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Citation Probability Score
              </div>
              <div className={`text-6xl font-bold tabular-nums ${status.color}`}>
                {pct}<span className="text-3xl">%</span>
              </div>
              <div className={`mt-1 text-sm font-semibold ${status.color}`}>
                {status.label}
              </div>
              <div className="mt-3 text-[12px] text-slate-500">
                {score} / {MAX_SCORE} points
              </div>
              {/* Bar */}
              <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Factor Breakdown
              </div>
              <div className="space-y-2.5">
                {SECTIONS.map((s) => {
                  const ss2 = sectionScores[s.id];
                  const sp = Math.round((ss2.score / ss2.max) * 100);
                  return (
                    <div key={s.id}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[12px] text-slate-400">{s.title}</span>
                        <span className="text-[11px] font-mono text-slate-500">{sp}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-cyan-500/50 transition-all duration-300"
                          style={{ width: `${sp}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interpretation */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-[12px] leading-relaxed text-slate-400 space-y-2">
              <p><span className="text-green-400 font-semibold">85–100%</span> — Content is structurally eligible for AI citation selection.</p>
              <p><span className="text-amber-400 font-semibold">65–84%</span> — Citation-eligible for some queries. Specific gaps are limiting broader AI visibility.</p>
              <p><span className="text-orange-400 font-semibold">40–64%</span> — Retrieved but rarely cited. Multiple structural issues need addressing.</p>
              <p><span className="text-red-400 font-semibold">0–39%</span> — Content is unlikely to reach citation selection threshold in AI retrieval pipelines.</p>
            </div>

            {/* CTA */}
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <div className="mb-2 text-sm font-semibold text-white">
                Get a Full Site Audit
              </div>
              <p className="mb-4 text-[12px] leading-relaxed text-slate-400">
                This checklist covers one page. SiteNexis audits your entire domain across 12
                intelligence dimensions — with explainable scores for every page.
              </p>
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-[#0A1628] transition-opacity hover:opacity-90"
              >
                Start Free — 10 Credits Included
                <ExternalLink size={13} />
              </Link>
            </div>

            {/* Reset */}
            <button
              onClick={() => setChecked({})}
              className="w-full rounded-xl border border-white/[0.06] py-2.5 text-sm text-slate-500 transition-colors hover:text-slate-300"
            >
              Reset checklist
            </button>
          </div>
        </div>
      </div>

      {/* Formula footer */}
      <div className="border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-slate-600">
            Citation Probability Formula
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {SECTIONS.map((s) => (
              <div key={s.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-center">
                <div className="text-lg font-bold text-white">{s.weight}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{s.title}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-slate-600">
            Based on the SiteNexis Citation Probability Engine ·{' '}
            <Link href="/content-map" className="text-cyan-500/70 hover:text-cyan-400">
              View full knowledge graph →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
