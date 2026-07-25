'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion';
import {
  ArrowRight, Search, ChevronDown, CheckCircle2, AlertTriangle,
  Info, Play, Radar,
} from 'lucide-react';
import { HealthScoreRing } from '@/components/health/HealthScoreRing';

// ─── Types (mirror apps/web/src/app/api/demo/observatory/route.ts) ───────────

interface ObservatoryCard {
  domain: string;
  label: string;
  category: string;
  description: string;
  completedAt: string;
  pageCount: number;
  overall: number;
  aiVisibility: number | null;
  machineTrust: number | null;
  retrieval: number | null;
  citation: number | null;
  schema: number;
  critical: number;
  warnings: number;
  passed: number;
  badges: string[];
  confidence: 'medium' | 'high';
  topIssues: { severity: string; module: string; message: string; recommendation: string }[];
}

interface ObservatoryStats {
  totalAuditsCompleted: number;
  averageOverallScore: number;
  domainsAnalyzed: number;
  categoriesRepresented: number;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function scoreColor(score: number): string {
  return score >= 80 ? '#22C55E' : score >= 60 ? '#0BCEBC' : score >= 40 ? '#F59E0B' : '#EF4444';
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

// ─── Animated stat counter ────────────────────────────────────────────────────

function StatCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    let start: number | null = null;
    const duration = 1400;
    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min((now - start) / duration, 1);
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <div ref={ref} className="text-center">
      <p className="tabular-nums text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold text-white">
        {display.toLocaleString()}{suffix}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

// ─── Metric bar ────────────────────────────────────────────────────────────────

function MetricBar({ label, value }: { label: string; value: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const color = value !== null ? scoreColor(value) : '#334155';

  return (
    <div ref={ref}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-slate-300">{value ?? '—'}</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={inView && value !== null ? { width: `${value}%` } : { width: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </div>
    </div>
  );
}

// ─── Badge chip ────────────────────────────────────────────────────────────────

function BadgeChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-cyan/20 bg-cyan/[0.06] px-2.5 py-1 text-[10px] font-medium text-cyan">
      <CheckCircle2 size={10} strokeWidth={2.5} />
      {label}
    </span>
  );
}

// ─── Replay audit sequence ────────────────────────────────────────────────────

const REPLAY_STEPS = [
  'Checking robots.txt',
  'Checking sitemap',
  'Checking structured data',
  'Checking entity clarity',
  'Checking retrieval readiness',
  'Checking machine trust signals',
  'Compiling report',
];

function ReplaySequence({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) { setStep(0); return; }
    if (step >= REPLAY_STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [active, step]);

  if (!active) return null;

  return (
    <div className="space-y-1.5 rounded-button border border-white/[0.06] bg-black/20 p-3 font-mono text-[11px]">
      {REPLAY_STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i < step ? (
            <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />
          ) : i === step ? (
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-cyan/30 border-t-cyan" />
          ) : (
            <span className="h-3 w-3 shrink-0 rounded-full border border-white/10" />
          )}
          <span className={i <= step ? 'text-slate-300' : 'text-slate-600'}>{label}{i < step ? ' — done' : i === step ? '…' : ''}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Audit card ────────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<string, typeof CheckCircle2> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

function ObservatoryCardView({ card }: { card: ObservatoryCard }) {
  const [expanded, setExpanded] = useState(false);
  const [replaying, setReplaying] = useState(false);

  return (
    <motion.div
      variants={fadeUp}
      className="card-glow card-glow-teal group relative overflow-hidden rounded-card border border-white/[0.06] bg-[#0A1628] transition-colors duration-300 hover:border-cyan/20"
    >
      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-white">{card.label}</h3>
              <span className="shrink-0 rounded-pill border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {card.category}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">{card.domain} &middot; {card.description}</p>
            <p className="mt-1 text-[10px] text-slate-600">Completed {timeAgo(card.completedAt)} &middot; {card.pageCount} pages &middot; {card.confidence === 'high' ? 'High' : 'Medium'} confidence</p>
          </div>
          <HealthScoreRing score={card.overall} label="" color={scoreColor(card.overall)} size={64} />
        </div>

        {/* Sub-scores */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <MetricBar label="AI Visibility" value={card.aiVisibility} />
          <MetricBar label="Machine Trust" value={card.machineTrust} />
          <MetricBar label="Retrieval" value={card.retrieval} />
          <MetricBar label="Citation" value={card.citation} />
        </div>

        {/* Issue counts */}
        <div className="mt-4 flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={11} /> {card.critical} critical</span>
          <span className="flex items-center gap-1 text-amber-400"><AlertTriangle size={11} /> {card.warnings} warnings</span>
          <span className="flex items-center gap-1 text-slate-500"><CheckCircle2 size={11} /> {card.passed} passed</span>
        </div>

        {/* Badges */}
        {card.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.badges.map((b) => <BadgeChip key={b} label={b} />)}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t border-white/[0.04] pt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-button border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/[0.05]"
          >
            Evidence <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setReplaying((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 rounded-button border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/[0.05]"
            aria-label="Replay audit steps"
          >
            <Play size={12} />
          </button>
          <Link
            href={`/audit/${encodeURIComponent(card.domain)}?demo=true`}
            className="inline-flex items-center gap-1.5 rounded-button border border-cyan/20 bg-cyan/[0.07] px-3 py-2 text-[12px] font-semibold text-cyan transition-all hover:bg-cyan/[0.14]"
          >
            View report <ArrowRight size={12} />
          </Link>
        </div>

        {/* Evidence + replay panel */}
        <AnimatePresence initial={false}>
          {(expanded || replaying) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3">
                {replaying && <ReplaySequence active={replaying} />}
                {expanded && (
                  <div className="space-y-2">
                    {card.topIssues.map((issue, i) => {
                      const Icon = SEVERITY_ICON[issue.severity] ?? Info;
                      return (
                        <div key={i} className="rounded-button border border-white/[0.05] bg-white/[0.015] p-3">
                          <div className="flex items-start gap-2">
                            <Icon size={13} className={`mt-0.5 shrink-0 ${issue.severity === 'critical' ? 'text-red-400' : issue.severity === 'warning' ? 'text-amber-400' : 'text-slate-500'}`} />
                            <div className="min-w-0">
                              <p className="text-[12px] text-slate-300">{issue.message}</p>
                              <p className="mt-1 text-[11px] text-slate-600">Fix: {issue.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

type SortKey = 'score-desc' | 'score-asc' | 'recent' | 'critical';

const SORTERS: Record<SortKey, (a: ObservatoryCard, b: ObservatoryCard) => number> = {
  'score-desc': (a, b) => b.overall - a.overall,
  'score-asc': (a, b) => a.overall - b.overall,
  recent: (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  critical: (a, b) => b.critical - a.critical,
};

export function LiveAuditObservatory() {
  const { data, isLoading } = useQuery<{ cards: ObservatoryCard[]; stats: ObservatoryStats | null }>({
    queryKey: ['demo-observatory'],
    queryFn: () => fetch('/api/demo/observatory').then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortKey>('score-desc');

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(cards.map((c) => c.category)))], [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards
      .filter((c) => category === 'all' || c.category === category)
      .filter((c) => !q || c.label.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
      .sort(SORTERS[sort]);
  }, [cards, search, category, sort]);

  return (
    <section className="border-t border-white/[0.05] bg-[#07111F] py-32 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-5 flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase"
          >
            <Radar size={12} /> Live AI Audit Observatory
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white"
          >
            Watch real websites
            <br />
            <span className="font-normal text-slate-400">earn trust, live.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.8] text-[#94A3B8]"
          >
            These are not mockups. Every score below comes from a real crawl, every issue from live evidence,
            every recommendation is deterministic. Expand a card to see the evidence, replay how it was produced,
            or open the full report.
          </motion.p>
        </div>

        {/* Live stats */}
        {data?.stats && (
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="mb-14 grid grid-cols-2 gap-6 rounded-card border border-white/[0.06] bg-white/[0.015] p-8 sm:grid-cols-4"
          >
            <motion.div variants={fadeUp}><StatCounter value={data.stats.totalAuditsCompleted} label="Audits completed" /></motion.div>
            <motion.div variants={fadeUp}><StatCounter value={data.stats.averageOverallScore} label="Average score" /></motion.div>
            <motion.div variants={fadeUp}><StatCounter value={data.stats.domainsAnalyzed} label="Domains featured" /></motion.div>
            <motion.div variants={fadeUp}><StatCounter value={data.stats.categoriesRepresented} label="Categories" /></motion.div>
          </motion.div>
        )}

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={[
                  'rounded-pill border px-3 py-1.5 text-[12px] font-medium capitalize transition-colors',
                  category === c
                    ? 'border-cyan/30 bg-cyan/[0.1] text-cyan'
                    : 'border-white/[0.07] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]',
                ].join(' ')}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company or domain"
                className="w-full rounded-button border border-white/[0.07] bg-white/[0.02] py-2 pl-8 pr-3 text-[12px] text-white placeholder:text-slate-600 outline-none focus:border-cyan/20 sm:w-56"
                aria-label="Search audits"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-button border border-white/[0.07] bg-white/[0.02] py-2 px-3 text-[12px] text-slate-300 outline-none focus:border-cyan/20"
              aria-label="Sort audits"
            >
              <option value="score-desc">Highest score</option>
              <option value="score-asc">Lowest score</option>
              <option value="recent">Most recent</option>
              <option value="critical">Most critical issues</option>
            </select>
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-card bg-white/[0.02]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-white/[0.06] bg-white/[0.02] p-12 text-center text-sm text-slate-500">
            No audits match this filter yet.
          </div>
        ) : (
          <motion.div
            className="grid gap-6 md:grid-cols-2"
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}
          >
            {filtered.map((card) => <ObservatoryCardView key={card.domain} card={card} />)}
          </motion.div>
        )}

        <p className="mt-8 text-center text-[12px] text-slate-500">
          Every audit above is real — run by SiteNexis against a live domain. Scores, issues, and recommendations
          are generated from that crawl, not a template. Run your own audit above to see the same depth of evidence.
        </p>
      </div>
    </section>
  );
}
