import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Clock, Tag } from 'lucide-react'
import { BLOG_POSTS, getPost, getRelatedPosts, type ContentBlock } from '@/lib/blog-posts'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ShareButtons } from '@/components/ShareButtons'

// ── Static generation ─────────────────────────────────────────────────────────

export function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Not Found' }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app'
  return {
    title: `${post.title} — SiteNexis Blog`,
    description: post.excerpt,
    openGraph: {
      title: `${post.title} — SiteNexis Blog`,
      description: post.excerpt,
      url: `${appUrl}/blog/${slug}`,
      siteName: 'SiteNexis',
      type: 'article',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@Sitenexis',
      title: `${post.title} — SiteNexis Blog`,
      description: post.excerpt,
      images: ['/opengraph-image'],
    },
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
  'AI Agents':      { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

function getStyle(cat: string) {
  return CAT_COLORS[cat] ?? { text: 'text-slate-400', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]' }
}

// ── Inline rich-text: parse [label](href) patterns inside paragraph text ─────

function RichText({ text }: { text: string }) {
  const segments = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return (
    <>
      {segments.map((seg, i) => {
        const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(seg)
        if (m) {
          const [, label, href] = m
          const isExternal = href.startsWith('http')
          return isExternal ? (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer"
              className="text-cyan-400 underline decoration-cyan-400/30 underline-offset-2 transition-all hover:decoration-cyan-400/70">
              {label}
            </a>
          ) : (
            <Link key={i} href={href}
              className="text-cyan-400 underline decoration-cyan-400/30 underline-offset-2 transition-all hover:decoration-cyan-400/70">
              {label}
            </Link>
          )
        }
        return <span key={i}>{seg}</span>
      })}
    </>
  )
}

// ── Content block renderer ────────────────────────────────────────────────────

function RenderBlock({ block, allPosts }: { block: ContentBlock; allPosts: ReturnType<typeof getPost>[] }) {
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
          <RichText text={block.text} />
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
              <span className="flex-1"><RichText text={item} /></span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-5 space-y-3 pl-0">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.75] text-slate-400">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/60" />
              <span className="flex-1"><RichText text={item} /></span>
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
            <RichText text={block.text} />
          </p>
        </div>
      )
    }
    case 'cta':
      return (
        <div className="my-8 rounded-2xl border border-cyan-500/[0.18] bg-gradient-to-br from-cyan-500/[0.05] to-teal-500/[0.03] p-6">
          <p className="text-[14px] leading-[1.8] text-slate-300">{block.body}</p>
          <Link
            href={block.href}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-[13px] font-bold text-[#050816] transition-all hover:-translate-y-px active:scale-[0.98]"
          >
            {block.btnText} <ArrowRight size={13} />
          </Link>
        </div>
      )
    case 'related': {
      const posts = block.slugs.map(s => allPosts.find(p => p?.slug === s)).filter(Boolean)
      if (!posts.length) return null
      return (
        <div className="my-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {block.label ?? 'Related Reading'}
          </p>
          <div className="space-y-2">
            {posts.map((p) => p && (
              <Link key={p.slug} href={`/blog/${p.slug}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.04] group">
                <span className="h-1 w-1 shrink-0 rounded-full bg-teal-400/50" />
                <span className="flex-1 text-[13px] text-slate-400 group-hover:text-slate-200 transition-colors leading-snug">{p.title}</span>
                <ArrowRight size={11} className="shrink-0 text-slate-700 group-hover:text-teal-400 transition-colors" />
              </Link>
            ))}
          </div>
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
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Clock size={10} strokeWidth={1.5} /> {post.readTime} min · {post.publishedAt}
      </p>
    </Link>
  )
}

// ── Watermark ────────────────────────────────────────────────────────────────

function BlogWatermark() {
  const cx = 60, cy = 60, r = 50
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return (
    <div
      aria-hidden
      className="pointer-events-none select-none fixed inset-0 z-0 flex flex-col items-center justify-center gap-4 opacity-[0.045]"
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <polygon points={pts} stroke="white" strokeWidth="2.5" fill="rgba(255,255,255,0.06)" />
        <polygon
          points={Array.from({ length: 5 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
            return `${cx + r * 0.52 * Math.cos(a)},${cy + r * 0.52 * Math.sin(a)}`
          }).join(' ')}
          stroke="rgba(0,200,255,0.7)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
      <div className="flex flex-col items-center gap-1">
        <span
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}
          className="text-[42px] font-bold text-white leading-none"
        >
          SiteNexis
        </span>
        <span className="text-[14px] font-medium tracking-[0.18em] uppercase text-white/80">
          AI Visibility Intelligence
        </span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const related = getRelatedPosts(post)
  const style = getStyle(post.category)
  const allPosts = BLOG_POSTS.map(p => getPost(p.slug))

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `https://sitenexis.com/blog/${post.slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://sitenexis.com/blog/${post.slug}`,
    },
    author: {
      '@type': 'Person',
      '@id': 'https://sitenexis.com/#founder',
      name: 'Ekeleme David Kelechi',
      url: 'https://sitenexis.com/about',
    },
    publisher: {
      '@id': 'https://sitenexis.com/#organization',
      '@type': 'Organization',
      name: 'SiteNexis',
      logo: { '@type': 'ImageObject', url: 'https://sitenexis.com/favicon.svg' },
    },
    keywords: post.tags.join(', '),
    articleSection: post.category,
  };

  return (
    <main className="min-h-screen bg-[#07111F] text-white antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <MarketingNav />

      <BlogWatermark />

      {/* ── Post content ──────────────────────────────────────────────────── */}
      <article className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-[1fr_320px]">

            {/* Main content */}
            <div>
              {/* Back */}
              <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-[12px] text-slate-400 transition-colors hover:text-white">
                <ArrowLeft size={12} strokeWidth={2} />
                Back to Blog
              </Link>

              {/* Meta */}
              <div className="mb-7 flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${style.text} ${style.bg} ${style.border}`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                  {post.category}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
                  <Clock size={11} strokeWidth={1.5} /> {post.readTime} min read
                </span>
                <span className="text-[12px] text-slate-500">{post.publishedAt}</span>
              </div>

              {/* Title */}
              <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white text-balance">
                {post.title}
              </h1>

              {/* Excerpt */}
              <p className="mt-5 text-[17px] leading-[1.8] text-slate-400 max-w-2xl">
                {post.excerpt}
              </p>

              {/* Divider + share */}
              <div className="mt-8 mb-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <ShareButtons
                  url={`https://sitenexis.com/blog/${post.slug}`}
                  title={post.title}
                  compact
                />
              </div>

              {/* Body */}
              <div className="py-4">
                {post.content.map((block, i) => (
                  <RenderBlock key={i} block={block} allPosts={allPosts} />
                ))}
              </div>

              {/* Tags + bottom share */}
              <div className="mt-14 border-t border-white/[0.05] pt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[11px] text-slate-500 self-center mr-2">Tags:</span>
                    {post.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
                        <Tag size={9} strokeWidth={1.5} /> {tag}
                      </span>
                    ))}
                  </div>
                  <ShareButtons
                    url={`https://sitenexis.com/blog/${post.slug}`}
                    title={post.title}
                  />
                </div>
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
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Related Articles</p>
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
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
              <PentagonMark size={14} />
            </div>
            <span className="text-[14px] font-semibold text-white">SiteNexis</span>
          </div>
          <p className="text-[12px] text-slate-400">© {new Date().getFullYear()} SiteNexis. Built for the machine-first web.</p>
          <div className="flex items-center gap-5 text-[12px] text-slate-400">
            <a
              href="https://twitter.com/Sitenexis"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-400 transition-colors"
              aria-label="SiteNexis on X"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.633 5.902-5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @Sitenexis
            </a>
            <a href="mailto:sitenexisintel@gmail.com" className="hover:text-slate-400 transition-colors">
              sitenexisintel@gmail.com
            </a>
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
