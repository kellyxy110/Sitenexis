import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Clock, Tag } from 'lucide-react'
import { BLOG_POSTS, getPost, getRelatedPosts, type ContentBlock } from '@/lib/blog-posts'

// ── Static generation ─────────────────────────────────────────────────────────

export function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Not Found' }
  return {
    title: `${post.title} — SiteNexis Blog`,
    description: post.excerpt,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'AI Visibility':  { text: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  'Machine Trust':  { text: 'text-teal-400',   bg: 'bg-teal-500/10',   border: 'border-teal-500/20'   },
  'Entity SEO':     { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  'Technical SEO':  { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  'Strategy':       { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
}

function getStyle(cat: string) {
  return CAT_COLORS[cat] ?? { text: 'text-slate-400', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]' }
}

// ── Content block renderer ────────────────────────────────────────────────────

function RenderBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-12 mb-4 text-[1.45rem] font-bold leading-[1.2] tracking-[-0.025em] text-white first:mt-0">
          {block.text}
        </h2>
      )
    case 'h3':
      return (
        <h3 className="mt-8 mb-3 text-[1.15rem] font-semibold leading-[1.3] tracking-[-0.015em] text-slate-200">
          {block.text}
        </h3>
      )
    case 'p':
      return (
        <p className="mt-4 text-[15px] leading-[1.85] text-slate-400">
          {block.text}
        </p>
      )
    case 'list':
      return block.ordered ? (
        <ol className="mt-5 space-y-3 pl-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.75] text-slate-400">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-teal-500/25 bg-teal-500/[0.08] text-[10px] font-bold text-teal-400">
                {i + 1}
              </span>
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-5 space-y-3 pl-0">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.75] text-slate-400">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/60" />
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'callout': {
      const variants = {
        info:    { bg: 'bg-cyan-500/[0.07]',   border: 'border-cyan-500/[0.15]',   icon: '●', iconColor: 'text-cyan-400'  },
        tip:     { bg: 'bg-teal-500/[0.07]',   border: 'border-teal-500/[0.15]',   icon: '◆', iconColor: 'text-teal-400'  },
        warning: { bg: 'bg-amber-500/[0.07]',  border: 'border-amber-500/[0.15]',  icon: '▲', iconColor: 'text-amber-400' },
      }
      const v = variants[block.variant]
      return (
        <div className={`mt-7 rounded-2xl border ${v.bg} ${v.border} p-5`}>
          <p className="flex items-start gap-3 text-[13px] leading-[1.8] text-slate-300">
            <span className={`mt-0.5 shrink-0 text-[10px] ${v.iconColor}`}>{v.icon}</span>
            {block.text}
          </p>
        </div>
      )
    }
    default:
      return null
  }
}

// ── Related post card ─────────────────────────────────────────────────────────

function RelatedCard({ post }: { post: ReturnType<typeof getPost> & object }) {
  if (!post) return null
  const style = getStyle(post.category)
  return (
    <Link href={`/blog/${post.slug}`} className="card-glow group block rounded-[18px] border border-white/[0.07] bg-[#0A1628] p-5 transition-all duration-300">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.text} ${style.bg} ${style.border}`}>
        {post.category}
      </span>
      <h3 className="mt-3 text-[13px] font-semibold leading-[1.4] text-slate-300 transition-colors group-hover:text-white">
        {post.title}
      </h3>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
        <Clock size={10} strokeWidth={1.5} /> {post.readTime} min · {post.publishedAt}
      </p>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const related = getRelatedPosts(post)
  const style = getStyle(post.category)

  return (
    <main className="min-h-screen bg-[#07111F] text-white antialiased font-sans">

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="border-b border-white/[0.05] bg-[#07111F]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 md:py-5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition-colors group-hover:border-white/[0.14]">
                <PentagonMark size={16} />
              </div>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">SiteNexis</span>
            </Link>
            <nav className="hidden items-center gap-7 md:flex">
              {['Platform', 'Pricing', 'Docs', 'Blog'].map(label => (
                <Link key={label} href={label === 'Blog' ? '/blog' : `/${label.toLowerCase()}`}
                  className={`text-sm transition-colors duration-150 ${label === 'Blog' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden text-sm text-slate-400 hover:text-slate-200 sm:block transition-colors">Log in</Link>
              <Link href="/signup" className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.08] backdrop-blur-sm">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Post content ──────────────────────────────────────────────────── */}
      <article className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-[1fr_320px]">

            {/* Main content */}
            <div>
              {/* Back */}
              <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-[12px] text-slate-600 transition-colors hover:text-slate-400">
                <ArrowLeft size={12} strokeWidth={2} />
                Back to Blog
              </Link>

              {/* Meta */}
              <div className="mb-7 flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${style.text} ${style.bg} ${style.border}`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                  {post.category}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <Clock size={11} strokeWidth={1.5} /> {post.readTime} min read
                </span>
                <span className="text-[12px] text-slate-700">{post.publishedAt}</span>
              </div>

              {/* Title */}
              <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white text-balance">
                {post.title}
              </h1>

              {/* Excerpt */}
              <p className="mt-5 text-[17px] leading-[1.8] text-slate-400 max-w-2xl">
                {post.excerpt}
              </p>

              {/* Divider */}
              <div className="mt-10 mb-2 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              {/* Body */}
              <div className="py-4">
                {post.content.map((block, i) => (
                  <RenderBlock key={i} block={block} />
                ))}
              </div>

              {/* Tags */}
              <div className="mt-14 flex flex-wrap gap-2 border-t border-white/[0.05] pt-8">
                <span className="text-[11px] text-slate-700 self-center mr-2">Tags:</span>
                {post.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] text-slate-500">
                    <Tag size={9} strokeWidth={1.5} /> {tag}
                  </span>
                ))}
              </div>

              {/* Nav between posts */}
              <div className="mt-10 flex items-center justify-between gap-4">
                <Link href="/blog" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-[13px] text-slate-400 transition-all hover:border-white/[0.14] hover:text-white">
                  <ArrowLeft size={13} /> All articles
                </Link>
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-3 text-[13px] font-bold text-[#050816] transition-all hover:shadow-[0_0_20px_rgba(0,200,255,0.25)] hover:-translate-y-0.5">
                  Run free audit <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-28 space-y-6">

                {/* Audit CTA card */}
                <div className="card-glow relative overflow-hidden rounded-[20px] border border-teal-500/[0.15] bg-[#0A1628] p-6">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-500/[0.07] to-transparent" />
                  <div className="relative">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-400/70 mb-2">Free Tool</p>
                    <h3 className="text-[17px] font-bold text-white leading-[1.3]">See how AI reads your site</h3>
                    <p className="mt-2 text-[13px] text-slate-500 leading-[1.7]">Full intelligence report in 60 seconds. No account required.</p>
                    <Link href="/" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-[13px] font-bold text-[#050816] transition-all hover:shadow-[0_0_20px_rgba(0,200,255,0.25)]">
                      Run Free Audit <ArrowRight size={13} strokeWidth={2.5} />
                    </Link>
                  </div>
                </div>

                {/* Related posts */}
                {related.length > 0 && (
                  <div>
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">Related Articles</p>
                    <div className="space-y-3">
                      {related.map(rel => (
                        <RelatedCard key={rel.slug} post={rel} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

          </div>
        </div>
      </article>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#07111F] px-6 py-12">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
              <PentagonMark size={14} />
            </div>
            <span className="text-[14px] font-semibold text-white">SiteNexis</span>
          </div>
          <p className="text-[12px] text-slate-700">© {new Date().getFullYear()} SiteNexis. Built for the machine-first web.</p>
          <div className="flex items-center gap-6 text-[12px] text-slate-700">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
