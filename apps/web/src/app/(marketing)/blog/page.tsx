'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Tag } from 'lucide-react'
import { BLOG_POSTS, CATEGORIES, type BlogPost } from '@/lib/blog-posts'
import { MarketingNav } from '@/components/marketing/MarketingNav'

// ── Helpers ──────────────────────────────────────────────────────────────────

function PentagonMark({ size = 20 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
    </svg>
  )
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  'AI Visibility':    { text: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   glow: 'rgba(0,200,255,0.18)'     },
  'Machine Trust':    { text: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20',   glow: 'rgba(11,206,188,0.18)'    },
  'Entity SEO':       { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'rgba(139,92,246,0.18)'    },
  'Technical SEO':    { text: 'text-sapphire-400',bg: 'bg-blue-500/10',  border: 'border-blue-500/20',   glow: 'rgba(59,130,246,0.18)'    },
  'Strategy':         { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  glow: 'rgba(245,158,11,0.18)'    },
  'AI Agents':        { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'rgba(139,92,246,0.22)'    },
}

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', glow: 'rgba(255,255,255,0.1)' }
}

// ── Post card ──────────────────────────────────────────────────────────────────

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const style = getCategoryStyle(post.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="group h-full"
    >
      <Link
        href={`/blog/${post.slug}`}
        className={[
          'card-glow relative flex h-full flex-col rounded-[20px] p-6 md:p-8',
          'border border-white/[0.07] bg-[#0A1628]',
          featured ? 'md:flex-row md:gap-10 md:items-center' : '',
        ].join(' ')}
        style={{
          '--glow-color': style.glow,
        } as React.CSSProperties}
      >
        {/* Category + meta */}
        <div className={featured ? 'md:flex-1' : ''}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${style.text} ${style.bg} ${style.border}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
              {post.category}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock size={11} strokeWidth={1.5} />
              {post.readTime} min read
            </span>
            <span className="text-[11px] text-slate-500">{post.publishedAt}</span>
          </div>

          {/* Title */}
          <h2 className={[
            'font-bold leading-[1.2] tracking-[-0.02em] text-white transition-colors duration-200 group-hover:text-slate-100',
            featured ? 'text-[clamp(1.4rem,3vw,2rem)]' : 'text-[1.1rem]',
          ].join(' ')}>
            {post.title}
          </h2>

          {/* Excerpt */}
          <p className={[
            'mt-3 leading-[1.75] text-slate-400',
            featured ? 'text-[15px] max-w-xl' : 'text-[13px]',
          ].join(' ')}>
            {post.excerpt}
          </p>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
                <Tag size={8} strokeWidth={1.5} />
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* CTA arrow */}
        <div className={[
          'mt-5 flex items-center gap-2 text-[12px] font-medium transition-all duration-200',
          style.text,
          'group-hover:gap-3',
          featured ? 'md:mt-0 md:shrink-0 md:flex-col md:items-end md:gap-3' : '',
        ].join(' ')}>
          <span>Read article</span>
          <ArrowRight size={13} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>

        {/* Bottom glow accent line */}
        <div className={`absolute inset-x-0 bottom-0 h-px rounded-b-[20px] bg-gradient-to-r from-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          style={{ background: `linear-gradient(to right, transparent, ${style.glow.replace('0.18', '0.4')}, transparent)` }}
        />
      </Link>
    </motion.div>
  )
}

// ── Category pill ──────────────────────────────────────────────────────────────

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'shrink-0 rounded-full px-4 py-2 text-[12px] font-medium tracking-wide transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-white/[0.08] border border-white/[0.14] text-white'
          : 'border border-white/[0.12] bg-transparent text-slate-300 hover:border-white/[0.20] hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const filtered = activeCategory === 'All'
    ? BLOG_POSTS
    : BLOG_POSTS.filter(p => p.category === activeCategory)

  const [featured, ...rest] = filtered

  return (
    <main className="min-h-screen bg-[#07111F] text-white antialiased font-sans">

      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(0,200,255,0.06),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_30%_60%,rgba(11,206,188,0.04),transparent)]" />

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase mb-7">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400/70" />
              Intelligence for the machine-first web
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.08] tracking-[-0.04em] text-white text-balance"
          >
            SiteNexis{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #0BCEBC 0%, #00C8FF 60%)' }}>
              Blog
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
            className="mt-5 text-[17px] leading-[1.75] text-slate-500 max-w-2xl mx-auto"
          >
            Deep analysis of AI visibility, machine trust, entity optimization, and the future of content in a machine-first web.
          </motion.p>
        </div>
      </section>

      {/* ── Category filter ───────────────────────────────────────────────────── */}
      <div className="sticky top-[64px] z-40 border-y border-white/[0.05] bg-[#07111F]/95 backdrop-blur-xl px-6 py-3">
        <div className="mx-auto max-w-7xl">
          {/* Article count — own row, never lost inside pill wrap */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{filtered.length} articles</span>
          </div>
          {/* Pills: single scrollable row on mobile, wraps on md+ */}
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5 md:flex-wrap md:overflow-visible">
            {CATEGORIES.map(cat => (
              <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">

          {/* Featured post */}
          {featured && (
            <div className="mb-8">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Featured</p>
              <PostCard post={featured} featured />
            </div>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <>
              {filtered.length > 1 && (
                <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {activeCategory === 'All' ? 'All Articles' : activeCategory}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map(post => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <div className="py-32 text-center">
              <p className="text-slate-600">No articles in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-24 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan-400/70 uppercase">See It In Action</p>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
            Audit your domain.
            <br />
            <span className="text-slate-500 font-normal">See what AI systems see.</span>
          </h2>
          <p className="mt-4 text-[15px] text-slate-600 mx-auto max-w-sm">Free scan. No account required. Full intelligence report in 60 seconds.</p>
          <div className="mt-8">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-7 py-3.5 text-sm font-bold text-[#050816] transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,200,255,0.3)] hover:-translate-y-0.5">
              Run a free audit <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#07111F] px-6 py-12">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
              <PentagonMark size={14} />
            </div>
            <span className="text-[14px] font-semibold text-white">SiteNexis</span>
          </div>
          <p className="text-[12px] text-slate-400">© {new Date().getFullYear()} SiteNexis. Built for the machine-first web.</p>
          <div className="flex items-center gap-6 text-[12px] text-slate-400">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
