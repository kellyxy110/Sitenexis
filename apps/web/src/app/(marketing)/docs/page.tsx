'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import {
  BookOpen, Zap, Code2, Webhook, Key, Terminal,
  ChevronRight, Copy, Check, ExternalLink, ArrowRight,
} from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'

// ── Primitives ────────────────────────────────────────────────────────────────

function PentagonMark({ size = 16 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
      <polygon points={pts} stroke="rgba(11,206,188,0.35)" strokeWidth="0.6" fill="none"
        style={{ transform: `scale(0.55) translate(${size * 0.45}px, ${size * 0.45}px)` }} />
    </svg>
  )
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
    >{children}</motion.div>
  )
}

// ── Code block with copy ──────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#060E1A]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <span className="font-mono text-[10px] text-slate-600">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-500 transition-all hover:bg-white/[0.06] hover:text-slate-300">
          {copied ? <><Check size={11} className="text-teal-400" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4">
        <code className="font-mono text-[12px] leading-[1.9] text-slate-300">{code}</code>
      </pre>
    </div>
  )
}


// ── Sidebar sections ──────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'quickstart',   label: 'Quick Start',       icon: Zap },
  { id: 'auth',         label: 'Authentication',     icon: Key },
  { id: 'audit',        label: 'Running an Audit',   icon: Terminal },
  { id: 'scores',       label: 'Score Reference',    icon: BookOpen },
  { id: 'api',          label: 'API Reference',      icon: Code2 },
  { id: 'webhooks',     label: 'Webhooks',           icon: Webhook },
]

// ── Score reference data ──────────────────────────────────────────────────────

const SCORE_REF = [
  {
    name: 'AI Visibility Score', range: '0–100', tier: 'Tier 2',
    formula: 'Machine Readability × 0.15 + Entity Confidence × 0.20 + Retrieval Readiness × 0.20 + Citation Probability × 0.20 + Semantic Trust × 0.15 + Schema Completeness × 0.10',
    thresholds: [['90–100', 'Excellent', 'text-green-400'], ['70–89', 'Good', 'text-teal-400'], ['50–69', 'Needs Work', 'text-amber-400'], ['0–49', 'Critical', 'text-red-400']],
  },
  {
    name: 'Machine Trust Score', range: '0–100', tier: 'Tier 3',
    formula: 'Entity Credibility × 0.30 + Schema Trust Alignment × 0.20 + External Validation × 0.25 + Contradiction Absence × 0.15 + Trust Degradation Resistance × 0.10',
    thresholds: [],
  },
  {
    name: 'Retrieval Quality Score', range: '0–100', tier: 'Tier 3',
    formula: 'Chunk Stability Index × 25 + Answer Formation Probability × 25 + Summarisation Loss Score × 25 + Citation Eligibility Score × 25',
    thresholds: [],
  },
  {
    name: 'Machine Trust Intelligence', range: '0–100', tier: 'Tier 4',
    formula: 'Retrieval Quality × 0.20 + Machine Trust × 0.25 + Authority Velocity × 0.15 + Recommendation Surface × 0.20 + Entity Authenticity × 0.20',
    thresholds: [],
  },
]

// ── API endpoints ─────────────────────────────────────────────────────────────

const ENDPOINTS = [
  { method: 'POST', path: '/api/audit/start',         auth: true,  desc: 'Start a new domain audit' },
  { method: 'GET',  path: '/api/audit/:id',            auth: true,  desc: 'Fetch complete audit results' },
  { method: 'GET',  path: '/api/audit/:id/stream',     auth: true,  desc: 'SSE real-time audit progress' },
  { method: 'GET',  path: '/api/audit/:id/retrieval',  auth: true,  desc: 'Retrieval Simulation results' },
  { method: 'GET',  path: '/api/audit/:id/machine-trust', auth: true, desc: 'Machine Trust score + signals' },
  { method: 'GET',  path: '/api/audit/:id/temporal',   auth: true,  desc: 'Temporal Authority analysis' },
  { method: 'GET',  path: '/api/audit/:id/surfaces',   auth: true,  desc: 'Recommendation Surface Map' },
  { method: 'GET',  path: '/api/audits',               auth: true,  desc: 'Paginated audit history' },
  { method: 'POST', path: '/api/quick-audit',          auth: false, desc: 'Single-page scan (no auth, rate limited)' },
  { method: 'GET',  path: '/api/health',               auth: false, desc: 'Service health check' },
]

const METHOD_COLORS: Record<string, string> = {
  GET:  'text-teal-400 bg-teal-500/10 border-teal-500/20',
  POST: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('quickstart')

  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />

      <div className="mx-auto flex max-w-7xl gap-0 pt-[73px] md:gap-8 md:px-10">

        {/* ── Sidebar ── */}
        <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-56 shrink-0 overflow-y-auto border-r border-white/[0.05] py-8 md:block">
          <nav className="flex flex-col gap-1 pr-4">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Documentation</p>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setActiveSection(s.id)}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                  activeSection === s.id
                    ? 'bg-white/[0.06] text-white'
                    : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300',
                ].join(' ')}>
                <s.icon size={13} strokeWidth={1.5} />
                {s.label}
              </a>
            ))}
            <div className="mt-6 pt-6 border-t border-white/[0.05]">
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Resources</p>
              <a href="https://github.com/sitenexis" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-all hover:text-slate-300">
                <ExternalLink size={13} strokeWidth={1.5} /> GitHub
              </a>
              <Link href="/blog" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-all hover:text-slate-300">
                <BookOpen size={13} strokeWidth={1.5} /> Blog
              </Link>
            </div>
          </nav>
        </aside>

        {/* ── Content ── */}
        <main className="min-w-0 flex-1 px-6 py-12 md:px-0">

          {/* Quick Start */}
          <section id="quickstart" className="mb-20 scroll-mt-24">
            <Reveal>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/8 px-3 py-1 text-[11px] font-medium text-teal-400">
                <Zap size={11} /> Quick Start
              </div>
              <h1 className="mt-3 text-[36px] font-bold tracking-[-0.03em] text-white md:text-[46px]">Get started in 2 minutes</h1>
              <p className="mt-4 text-[16px] leading-[1.75] text-slate-400">
                SiteNexis audits any public domain across twelve intelligence dimensions. The fastest way to start is the dashboard — no API setup required.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  { num: '01', title: 'Create an account', desc: 'Sign up at sitenexis.vercel.app/signup. Free plan includes 1 audit per month.' },
                  { num: '02', title: 'Enter a domain', desc: 'Type any public domain into the audit input — e.g. stripe.com or yoursite.com.' },
                  { num: '03', title: 'Read your report', desc: 'Within 3–8 minutes, a full machine trust report lands in your dashboard.' },
                ].map(step => (
                  <div key={step.num} className="rounded-2xl border border-white/[0.07] bg-[#0A1628] p-5">
                    <div className="mb-3 text-[24px] font-bold tracking-tight text-white/10">{step.num}</div>
                    <div className="text-[14px] font-semibold text-white">{step.title}</div>
                    <p className="mt-1.5 text-[12px] leading-[1.7] text-slate-500">{step.desc}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* Auth */}
          <section id="auth" className="mb-20 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-2 border-t border-white/[0.05] pt-12">
                <Key size={16} className="text-slate-500" strokeWidth={1.5} />
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white">Authentication</h2>
              </div>
              <p className="mt-3 text-[15px] leading-[1.75] text-slate-400">
                The REST API uses Bearer token authentication. API access is available on Agency and Enterprise plans. Get your key from Dashboard → Settings → API Keys.
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <CodeBlock lang="bash" code={`# Add your API key to every request
curl https://sitenexis.vercel.app/api/audit/start \\
  -H "Authorization: Bearer snx_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "example.com"}'`} />
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-[13px] text-amber-400/80">
                <strong className="font-semibold text-amber-400">Security note:</strong> Never expose your API key client-side. Store it in environment variables only.
              </div>
            </Reveal>
          </section>

          {/* Running an audit */}
          <section id="audit" className="mb-20 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-2 border-t border-white/[0.05] pt-12">
                <Terminal size={16} className="text-slate-500" strokeWidth={1.5} />
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white">Running an Audit</h2>
              </div>
              <p className="mt-3 text-[15px] leading-[1.75] text-slate-400">
                Audits are asynchronous. POST to start, receive a job ID, then poll or stream progress via SSE.
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h3 className="mt-6 text-[16px] font-semibold text-white">1. Start an audit</h3>
              <CodeBlock lang="bash" code={`curl -X POST https://sitenexis.vercel.app/api/audit/start \\
  -H "Authorization: Bearer snx_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "domain": "example.com",
    "options": {
      "maxPages": 100,
      "includeLayer4": true
    }
  }'

# Response
{
  "auditId": "aud_8kXmN3pQ...",
  "status": "queued",
  "estimatedDuration": "3-8 minutes"
}`} />
            </Reveal>
            <Reveal delay={0.08}>
              <h3 className="mt-6 text-[16px] font-semibold text-white">2. Stream real-time progress</h3>
              <CodeBlock lang="javascript" code={`const source = new EventSource(
  'https://sitenexis.vercel.app/api/audit/aud_8kXmN3pQ.../stream',
  { headers: { Authorization: 'Bearer snx_live_...' } }
)

source.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // { agent: 'entity-agent', event: 'progress', percent: 42 }
  console.log(data)
}

source.addEventListener('complete', () => {
  source.close()
  // Fetch full results
})`} />
            </Reveal>
            <Reveal delay={0.1}>
              <h3 className="mt-6 text-[16px] font-semibold text-white">3. Fetch the report</h3>
              <CodeBlock lang="bash" code={`curl https://sitenexis.vercel.app/api/audit/aud_8kXmN3pQ... \\
  -H "Authorization: Bearer snx_live_..."

# Returns the full AuditReport including all twelve scores,
# issue lists, entity graph, and per-module breakdowns.`} />
            </Reveal>
          </section>

          {/* Score reference */}
          <section id="scores" className="mb-20 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-2 border-t border-white/[0.05] pt-12">
                <BookOpen size={16} className="text-slate-500" strokeWidth={1.5} />
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white">Score Reference</h2>
              </div>
              <p className="mt-3 text-[15px] leading-[1.75] text-slate-400">
                Every score is 0–100. Every deduction maps to a named Issue with a description and recommendation. All scores are fully reproducible — the same content always produces the same score.
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="mt-6 flex flex-col gap-4">
                {SCORE_REF.map(score => (
                  <div key={score.name} className="rounded-2xl border border-white/[0.07] bg-[#0A1628] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-white">{score.name}</span>
                          <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-500">{score.range}</span>
                        </div>
                        <div className="mt-2 font-mono text-[11px] leading-[1.8] text-slate-500">{score.formula}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-400">{score.tier}</span>
                    </div>
                    {score.thresholds.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {score.thresholds.map(([range, label, color]) => (
                          <div key={range} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1">
                            <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
                            <span className="text-[10px] text-slate-600">{range}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* API reference */}
          <section id="api" className="mb-20 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-2 border-t border-white/[0.05] pt-12">
                <Code2 size={16} className="text-slate-500" strokeWidth={1.5} />
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white">API Reference</h2>
              </div>
              <p className="mt-3 text-[15px] leading-[1.75] text-slate-400">
                All endpoints are REST and return JSON. Base URL: <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-slate-300">https://sitenexis.vercel.app</code>
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07]">
                {ENDPOINTS.map((ep, i) => (
                  <div key={ep.path} className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02] ${i < ENDPOINTS.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                    <span className={`mt-0.5 shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                    <div className="min-w-0 flex-1">
                      <code className="font-mono text-[13px] text-slate-200">{ep.path}</code>
                      <p className="mt-0.5 text-[12px] text-slate-500">{ep.desc}</p>
                    </div>
                    {!ep.auth && (
                      <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-600">Public</span>
                    )}
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* Webhooks */}
          <section id="webhooks" className="mb-20 scroll-mt-24">
            <Reveal>
              <div className="flex items-center gap-2 border-t border-white/[0.05] pt-12">
                <Webhook size={16} className="text-slate-500" strokeWidth={1.5} />
                <h2 className="text-[26px] font-bold tracking-[-0.02em] text-white">Webhooks</h2>
              </div>
              <p className="mt-3 text-[15px] leading-[1.75] text-slate-400">
                Register a webhook URL in Dashboard → Settings → Webhooks. SiteNexis will POST a signed payload to your endpoint when an audit completes or fails.
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h3 className="mt-6 text-[16px] font-semibold text-white">Payload schema</h3>
              <CodeBlock lang="json" code={`{
  "event": "audit.complete",
  "auditId": "aud_8kXmN3pQ...",
  "domain": "example.com",
  "timestamp": "2025-05-29T12:00:00Z",
  "scores": {
    "aiVisibility": 74,
    "machineTrust": 61,
    "retrievalQuality": 88,
    "machineTrustIntelligence": 71
  }
}`} />

              <h3 className="mt-6 text-[16px] font-semibold text-white">Verifying signatures</h3>
              <CodeBlock lang="javascript" code={`import crypto from 'crypto'

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return \`sha256=\${expected}\` === signature
}

// In your route handler:
const isValid = verifyWebhook(
  rawBody,
  req.headers['x-sitenexis-signature'],
  process.env.SITENEXIS_WEBHOOK_SECRET
)`} />
            </Reveal>
          </section>

          {/* CTA */}
          <Reveal>
            <div className="mb-12 rounded-2xl border border-white/[0.07] bg-[#0A1628] p-8 text-center">
              <h3 className="text-[20px] font-bold text-white">Ready to run your first audit?</h3>
              <p className="mt-2 text-[14px] text-slate-500">Free plan. No credit card. Results in minutes.</p>
              <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-[13px] font-bold text-[#050816] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,200,255,0.25)]">
                Start for free <ArrowRight size={13} />
              </Link>
            </div>
          </Reveal>
        </main>

        {/* ── Right sidebar: on this page ── */}
        <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-44 shrink-0 overflow-y-auto py-8 xl:block">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">On this page</p>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`}
                className="flex items-center gap-1.5 py-1 text-[12px] text-slate-500 transition-colors hover:text-slate-300">
                <ChevronRight size={10} /> {s.label}
              </a>
            ))}
          </nav>
        </aside>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-10">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                <PentagonMark size={14} />
              </div>
              <span className="text-[13px] font-semibold text-white">SiteNexis</span>
            </div>
            <p className="text-[12px] text-slate-600">© {new Date().getFullYear()} SiteNexis. Machine Trust Intelligence.</p>
            <div className="flex items-center gap-6">
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Blog', '/blog']].map(([l, h]) => (
                <Link key={l} href={h} className="text-[12px] text-slate-600 hover:text-slate-400">{l}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
