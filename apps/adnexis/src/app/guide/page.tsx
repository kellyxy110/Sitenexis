import Link from 'next/link';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const bg   = { primary: '#0D0D1A', card: '#16162A', elevated: '#1C1C30', border: '#2A2A4A' };
const col  = { purple: '#6C3EFF', teal: '#00D4AA', orange: '#FF6B35' };
const txt  = { primary: '#F0F0FF', secondary: '#9090B8', muted: '#5A5A8A' };

/* ─── Shared chrome: sidebar + topbar ───────────────────────────────────── */
function AppChrome({ children, active }: { children: React.ReactNode; active: string }) {
  const nav = [
    { id: 'dashboard', label: 'Overview',  dot: col.purple  },
    { id: 'vault',     label: 'Swipe Vault', dot: col.purple },
    { id: 'analyze',   label: 'Analyze',   dot: col.teal    },
    { id: 'generate',  label: 'Generate',  dot: col.orange  },
  ];
  return (
    <div style={{ display: 'flex', height: 440, background: bg.primary, borderRadius: 12, border: `1px solid ${bg.border}`, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: '#0A0A14', borderRight: `1px solid ${bg.border}`, padding: '20px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 16px 20px', borderBottom: `1px solid ${bg.border}` }}>
          <span style={{ color: txt.primary, fontWeight: 700, fontSize: 16 }}>
            Ad<span style={{ color: col.purple }}>Nexis</span>
          </span>
        </div>
        <nav style={{ padding: '12px 8px' }}>
          {nav.map(({ id, label, dot }) => (
            <div key={id} style={{
              padding: '8px 10px', borderRadius: 8, marginBottom: 2,
              background: active === id ? `${col.purple}22` : 'transparent',
              borderLeft: active === id ? `2px solid ${dot}` : '2px solid transparent',
              color: active === id ? txt.primary : txt.secondary,
              fontSize: 13, fontWeight: active === id ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: active === id ? dot : txt.muted, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </nav>
      </div>
      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 48, borderBottom: `1px solid ${bg.border}`, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${col.purple}33`, border: `1px solid ${col.purple}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: col.purple, fontWeight: 700 }}>U</span>
          </div>
        </div>
        {/* Page area */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Step wrapper ──────────────────────────────────────────────────────── */
function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 72 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: `linear-gradient(135deg, ${col.purple}, #9B6DFF)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#fff',
        }}>
          {n}
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: txt.primary, marginBottom: 6 }}>{title}</h2>
          <p style={{ fontSize: 15, color: txt.secondary, lineHeight: 1.6, maxWidth: 600 }}>{desc}</p>
        </div>
      </div>
      {/* Screenshot mockup */}
      <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: `1px solid ${bg.border}` }}>
        {/* Browser chrome */}
        <div style={{ background: '#08080F', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28CA41' }} />
          <div style={{ flex: 1, background: '#16162A', borderRadius: 6, padding: '4px 12px', marginLeft: 8, fontSize: 11, color: txt.muted }}>
            adnexis-ai.vercel.app
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Callout box ───────────────────────────────────────────────────────── */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: `${col.teal}0F`, border: `1px solid ${col.teal}30`, borderRadius: 10, padding: '12px 16px', marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
      <p style={{ fontSize: 14, color: txt.secondary, lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  );
}

/* ─── Score pill ────────────────────────────────────────────────────────── */
function ScorePill({ value, label }: { value: number; label: string }) {
  const c = value >= 80 ? col.teal : value >= 60 ? col.orange : '#EF4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', background: `${c}15` }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c }}>{value}</span>
      </div>
      <p style={{ fontSize: 10, color: txt.muted, margin: 0 }}>{label}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function GuidePage() {
  return (
    <div style={{ background: bg.primary, minHeight: '100vh', fontFamily: 'system-ui, Calibri, sans-serif', color: txt.primary }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${bg.border}`, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A14' }}>
        <Link href="/" style={{ textDecoration: 'none', fontSize: 18, fontWeight: 700, color: txt.primary }}>
          Ad<span style={{ color: col.purple }}>Nexis</span>
        </Link>
        <Link href="/login" style={{ textDecoration: 'none', background: col.purple, color: '#fff', padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          Get Started
        </Link>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '64px 24px 56px', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: `${col.purple}20`, border: `1px solid ${col.purple}40`, borderRadius: 20, padding: '4px 14px', fontSize: 12, color: col.purple, fontWeight: 600, marginBottom: 20, letterSpacing: '0.05em' }}>
          USER GUIDE
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2, marginBottom: 18, background: `linear-gradient(135deg, ${txt.primary}, #9090B8)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          How to Use AdNexis
        </h1>
        <p style={{ fontSize: 17, color: txt.secondary, lineHeight: 1.7 }}>
          From signup to your first AI-generated ad variation in under 5 minutes.
          Follow the steps below — each one shows exactly what you&apos;ll see on screen.
        </p>
      </div>

      {/* ── Steps ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* STEP 1 — Sign up */}
        <Step n={1} title="Create your account" desc="Go to adnexis-ai.vercel.app and click Sign Up. Enter your email and a password. You can also continue with Google.">
          <div style={{ background: bg.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 380, background: bg.card, border: `1px solid ${bg.border}`, borderRadius: 16, padding: 32 }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: txt.primary, marginBottom: 6 }}>
                  Ad<span style={{ color: col.purple }}>Nexis</span>
                </div>
                <p style={{ fontSize: 13, color: txt.secondary }}>AI Creative Intelligence Platform</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '4px 12px', borderRadius: 20, border: `1px solid ${bg.border}`, background: '#16162A', fontSize: 11, color: txt.muted }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: `${col.teal}99` }} />
                  From the makers of SiteNexis ↗
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Email</label>
                <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: txt.muted }}>you@example.com</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Password</label>
                <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: txt.muted }}>••••••••</div>
              </div>
              <div style={{ background: col.purple, borderRadius: 8, padding: '11px', textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#fff' }}>Create Account</div>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <span style={{ fontSize: 12, color: txt.muted }}>Already have an account? </span>
                <span style={{ fontSize: 12, color: col.purple }}>Sign in</span>
              </div>
            </div>
          </div>
        </Step>

        {/* STEP 2 — Dashboard */}
        <Step n={2} title="Your dashboard overview" desc="After login you land on the Overview page. It shows your total saved ads, how many have been analyzed, your average performance score, and your top hook type.">
          <AppChrome active="dashboard">
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: txt.primary, marginBottom: 4 }}>Overview</h1>
              <p style={{ fontSize: 12, color: txt.secondary, marginBottom: 20 }}>Your creative intelligence at a glance.</p>
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Ads',  value: '0',  color: '#A78BFF' },
                  { label: 'Analyzed',   value: '0',  color: col.teal  },
                  { label: 'Avg Score',  value: '—',  color: col.orange},
                  { label: 'Top Hook',   value: '—',  color: '#A78BFF' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ fontSize: 10, color: txt.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Quick links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Swipe Vault',  desc: 'Browse and search your saved ads', color: '#A78BFF' },
                  { label: 'Analyze Ad',   desc: 'Get full AI intelligence on any ad', color: col.teal   },
                  { label: 'Generate',     desc: 'Create platform-specific variations',  color: col.orange },
                ].map(({ label, desc, color }) => (
                  <div key={label} style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 10, padding: 16, cursor: 'pointer' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}20`, border: `1px solid ${color}40`, marginBottom: 10 }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: txt.primary, marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: 11, color: txt.secondary }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </AppChrome>
          <Tip>The dashboard updates automatically each time you add or analyze an ad. All four stats are live counts from your vault.</Tip>
        </Step>

        {/* STEP 3 — Add to vault */}
        <Step n={3} title="Add an ad to your Swipe Vault" desc='Click "Swipe Vault" in the sidebar, then hit the purple "Add Ad" button in the top-right. Paste the ad script, choose the platform, and optionally add a niche and tags.'>
          <AppChrome active="vault">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h1 style={{ fontSize: 18, fontWeight: 700, color: txt.primary, marginBottom: 2 }}>Swipe Vault</h1>
                  <p style={{ fontSize: 11, color: txt.secondary }}>0 ads saved</p>
                </div>
                <div style={{ background: col.purple, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Ad
                </div>
              </div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txt.muted }}>🔍 Search ads…</div>
                <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txt.muted }}>All Platforms ▾</div>
                <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txt.muted }}>All Hooks ▾</div>
              </div>
              {/* Empty state */}
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: 13, color: txt.secondary, marginBottom: 14 }}>No ads in your vault yet.</p>
                <div style={{ display: 'inline-block', background: `${col.purple}20`, borderRadius: 8, padding: '8px 18px', fontSize: 12, color: col.purple, fontWeight: 500, cursor: 'pointer' }}>Add your first ad</div>
              </div>
            </div>
          </AppChrome>

          {/* Modal mockup */}
          <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: `1px solid ${bg.border}` }}>
            <div style={{ background: '#08080F', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28CA41' }} />
              <div style={{ flex: 1, background: '#16162A', borderRadius: 6, padding: '4px 12px', marginLeft: 8, fontSize: 11, color: txt.muted }}>Add Ad modal</div>
            </div>
            <div style={{ background: `${bg.primary}CC`, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ background: bg.card, border: `1px solid ${bg.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 460 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: txt.primary }}>Add Ad to Vault</span>
                  <span style={{ color: txt.secondary, cursor: 'pointer', fontSize: 18 }}>×</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Platform</label>
                  <div style={{ background: bg.elevated, border: `1px solid ${col.purple}60`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: txt.primary }}>META ▾</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Ad Script / Transcript <span style={{ color: '#EF4444' }}>*</span></label>
                  <div style={{ background: bg.elevated, border: `1px solid ${col.purple}60`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: txt.primary, height: 80, lineHeight: 1.5 }}>
                    &ldquo;Are you tired of low-converting ads? We&apos;ve helped 200+ brands 3× their ROAS using one simple framework…&rdquo;
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Niche</label>
                    <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: txt.muted }}>e.g. ecommerce</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Tags</label>
                    <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: txt.muted }}>urgency, pain-point</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '10px', textAlign: 'center', fontSize: 13, color: txt.secondary, cursor: 'pointer' }}>Cancel</div>
                  <div style={{ flex: 1, background: col.purple, borderRadius: 8, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Add to Vault</div>
                </div>
              </div>
            </div>
          </div>
          <Tip>You can add ads directly from the Vault (saves first, analyze later) or go to <strong style={{ color: txt.primary }}>Analyze Ad</strong> to get instant results while saving at the same time.</Tip>
        </Step>

        {/* STEP 4 — Analyze */}
        <Step n={4} title="Analyze any ad script" desc='Click "Analyze Ad" in the sidebar. Select the platform, optionally add a niche, paste the full ad script or voiceover, then hit "Run Full Analysis". Results appear below the form.'>
          <AppChrome active="analyze">
            <div style={{ maxWidth: 560 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: txt.primary, marginBottom: 4 }}>Analyze Ad</h1>
              <p style={{ fontSize: 12, color: txt.secondary, marginBottom: 18 }}>Paste any ad script for full AI intelligence analysis.</p>
              <div style={{ background: bg.card, border: `1px solid ${bg.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Platform</label>
                    <div style={{ background: bg.elevated, border: `1px solid ${col.purple}60`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: txt.primary }}>META ▾</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Niche (optional)</label>
                    <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: txt.muted }}>e.g. fitness, ecommerce</div>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Ad Script / Transcript</label>
                  <div style={{ background: bg.elevated, border: `1px solid ${col.purple}60`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: txt.primary, height: 100, lineHeight: 1.6 }}>
                    &ldquo;Are you tired of low-converting ads? We&apos;ve helped 200+ brands triple their ROAS with one simple framework. Here&apos;s what most marketers get wrong…&rdquo;
                  </div>
                </div>
                <div style={{ background: col.purple, borderRadius: 8, padding: '11px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  ⚡ Run Full Analysis
                </div>
              </div>
            </div>
          </AppChrome>
          <Tip>The analysis is saved automatically to your Vault — you&apos;ll see it there with all scores attached. No need to add it separately.</Tip>
        </Step>

        {/* STEP 5 — Reading results */}
        <Step n={5} title="Read your analysis results" desc="After analysis completes, scores appear below the form. You get a Performance Score, Hook Type classification, Fatigue Risk rating, and a full breakdown of Hook strength, Body copy, and CTA quality.">
          <AppChrome active="analyze">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: txt.primary, marginBottom: 16 }}>Analysis Results</h2>
              {/* Score row */}
              <div style={{ background: bg.card, border: `1px solid ${bg.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 11, color: txt.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Performance Score</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 42, fontWeight: 800, color: col.teal }}>76</span>
                      <span style={{ fontSize: 16, color: txt.muted }}>/100</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ background: `${col.orange}20`, border: `1px solid ${col.orange}40`, borderRadius: 8, padding: '4px 12px', fontSize: 12, color: col.orange, marginBottom: 8 }}>
                      Hook type: <strong>authority</strong>
                    </div>
                    <div style={{ background: `${col.teal}20`, border: `1px solid ${col.teal}40`, borderRadius: 8, padding: '4px 12px', fontSize: 12, color: col.teal }}>
                      Fatigue risk: <strong>LOW</strong>
                    </div>
                  </div>
                </div>
              </div>
              {/* Sub-scores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
                <ScorePill value={82} label="Hook" />
                <ScorePill value={74} label="Body" />
                <ScorePill value={71} label="CTA" />
                <ScorePill value={68} label="Clarity" />
                <ScorePill value={79} label="Emotion" />
              </div>
              {/* Insight */}
              <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: txt.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Insight</p>
                <p style={{ fontSize: 12, color: txt.secondary, lineHeight: 1.6 }}>
                  Strong authority hook with social proof (&ldquo;200+ brands&rdquo;). Body copy establishes pain then bridges to solution — good structure.
                  CTA could be more specific. Consider adding a direct offer or scarcity signal.
                </p>
              </div>
            </div>
          </AppChrome>
          <Tip>Each sub-score is 0–100. Scores above 75 are strong. The AI Insight section tells you exactly what to improve and why.</Tip>
        </Step>

        {/* STEP 6 — Generate */}
        <Step n={6} title="Generate ad variations" desc='Go to "Generate" in the sidebar. Paste your source ad, select target platforms, choose a tone (Aggressive / Balanced / Premium), pick a localization if needed, and set how many variations you want.'>
          <AppChrome active="generate">
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: txt.primary, marginBottom: 4 }}>Creative Regenerator</h1>
              <p style={{ fontSize: 12, color: txt.secondary, marginBottom: 18 }}>Transform any ad into platform-specific high-converting variations.</p>
              <div style={{ background: bg.card, border: `1px solid ${bg.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 6 }}>Source Ad</label>
                  <div style={{ background: bg.elevated, border: `1px solid ${col.purple}60`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: txt.primary, height: 72, lineHeight: 1.6 }}>
                    &ldquo;Are you tired of low-converting ads? We&apos;ve helped 200+ brands triple their ROAS…&rdquo;
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 8 }}>Target Platforms</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['META', 'TIKTOK', 'YOUTUBE', 'NATIVE'].map((p) => (
                      <div key={p} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        background: p === 'META' ? `${col.purple}20` : bg.elevated,
                        border: `1px solid ${p === 'META' ? `${col.purple}50` : bg.border}`,
                        color: p === 'META' ? col.purple : txt.secondary,
                      }}>{p}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {/* Tone */}
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 8 }}>Tone</label>
                    {[['Aggressive','Bold, urgent'],['Balanced','Persuasive'],['Premium','Aspirational']].map(([l,d],i) => (
                      <div key={l} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 6, border: `1px solid ${i===1 ? `${col.purple}50` : bg.border}`, background: i===1 ? `${col.purple}15` : bg.elevated, cursor: 'pointer' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: i===1 ? col.purple : txt.secondary }}>{l}</p>
                        <p style={{ fontSize: 10, color: txt.muted }}>{d}</p>
                      </div>
                    ))}
                  </div>
                  {/* Localization */}
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 8 }}>Localization</label>
                    {['Global (Default)','Nigerian English','African Market','Global Premium'].map((l,i) => (
                      <div key={l} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 6, border: `1px solid ${i===0 ? `${col.teal}50` : bg.border}`, background: i===0 ? `${col.teal}15` : bg.elevated, cursor: 'pointer' }}>
                        <p style={{ fontSize: 11, color: i===0 ? col.teal : txt.secondary }}>{l}</p>
                      </div>
                    ))}
                  </div>
                  {/* Count */}
                  <div>
                    <label style={{ fontSize: 12, color: txt.secondary, display: 'block', marginBottom: 8 }}>Variations</label>
                    {[1,3,5,10].map((n) => (
                      <div key={n} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 6, border: `1px solid ${n===3 ? `${col.orange}50` : bg.border}`, background: n===3 ? `${col.orange}15` : bg.elevated, cursor: 'pointer' }}>
                        <p style={{ fontSize: 12, color: n===3 ? col.orange : txt.secondary }}>{n} variation{n>1?'s':''}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: col.purple, borderRadius: 8, padding: '11px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  🪄 Generate Variations
                </div>
              </div>
            </div>
          </AppChrome>
          <Tip>Select multiple platforms at once — AdNexis generates a tailored variation optimised for each platform&apos;s format and audience behaviour in a single run.</Tip>
        </Step>

        {/* STEP 7 — Variation output */}
        <Step n={7} title="Review and copy your variations" desc="Generated variations appear as cards. Each card shows: a predicted score, the hook type, a rewritten Hook, Body, and CTA, plus an AI rationale explaining the choices. Hit Copy to grab any variation instantly.">
          <AppChrome active="generate">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: txt.primary, marginBottom: 16 }}>3 Variations Generated</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Variation 1 — META', score: 84, hook: 'authority', hookText: 'We helped 312 brands escape the "ad graveyard" — here\'s the exact framework they used.', body: 'Most ads die in the first 3 seconds. Yours don\'t have to. Our AI-backed creative system pinpoints the exact moment you lose attention — and fixes it.', cta: 'See the framework →', color: col.purple },
                  { label: 'Variation 2 — META', score: 79, hook: 'curiosity', hookText: 'What if your worst-performing ad was actually 2 tweaks away from a 3× ROAS?', body: 'We run your creative through 14 conversion signals. Then we rebuild it. 200+ brands. Same result.', cta: 'Try it free', color: col.teal },
                ].map(({ label, score, hook, hookText, body, cta, color }) => (
                  <div key={label} style={{ background: bg.card, border: `1px solid ${bg.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: txt.primary, marginBottom: 6 }}>{label}</p>
                        <span style={{ fontSize: 10, background: `${color}20`, color, padding: '2px 8px', borderRadius: 20 }}>{hook}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color }}>{score}</span>
                        <span style={{ fontSize: 11, color: txt.muted }}>/100</span>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 10, color: txt.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hook</p>
                      <p style={{ fontSize: 12, color: txt.primary, lineHeight: 1.5 }}>&ldquo;{hookText}&rdquo;</p>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 10, color: txt.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body</p>
                      <p style={{ fontSize: 11, color: txt.secondary, lineHeight: 1.5 }}>{body}</p>
                    </div>
                    <div style={{ paddingTop: 10, borderTop: `1px solid ${bg.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{cta}</span>
                      <span style={{ fontSize: 11, color: txt.muted, cursor: 'pointer' }}>⎘ Copy</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AppChrome>
          <Tip>The predicted score on each card tells you which variation the AI thinks will perform best before you even test it. Start with the highest-scored one.</Tip>
        </Step>

        {/* STEP 8 — Browse vault */}
        <Step n={8} title="Browse and filter your Swipe Vault" desc="Every ad you add or analyze is saved in your Vault. Use the platform filter to find Meta ads, the hook type filter to find fear-based or authority hooks, or search by transcript keywords.">
          <AppChrome active="vault">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h1 style={{ fontSize: 18, fontWeight: 700, color: txt.primary, marginBottom: 2 }}>Swipe Vault</h1>
                  <p style={{ fontSize: 11, color: txt.secondary }}>6 ads saved</p>
                </div>
                <div style={{ background: col.purple, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#fff' }}>+ Add Ad</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txt.muted }}>🔍 ROAS</div>
                <div style={{ background: `${col.purple}20`, border: `1px solid ${col.purple}40`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: col.purple }}>META ▾</div>
                <div style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txt.muted }}>authority ▾</div>
              </div>
              {/* Ad cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { platform: 'META', score: 84, hook: 'authority', fatigue: 'LOW', color: col.teal },
                  { platform: 'META', score: 71, hook: 'curiosity', fatigue: 'MED', color: col.orange },
                  { platform: 'META', score: 76, hook: 'story',     fatigue: 'LOW', color: col.teal },
                ].map(({ platform, score, hook, fatigue, color }, i) => (
                  <div key={i} style={{ background: bg.elevated, border: `1px solid ${bg.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, background: `${col.purple}20`, color: col.purple, padding: '2px 8px', borderRadius: 20 }}>{platform}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color }}>{score}</span>
                    </div>
                    <div style={{ height: 36, background: bg.card, borderRadius: 6, marginBottom: 10 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: txt.muted }}>{hook}</span>
                      <span style={{ fontSize: 10, color, background: `${color}15`, padding: '2px 6px', borderRadius: 4 }}>{fatigue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AppChrome>
          <Tip>Saved ads without a score have a grey score area. Click <strong style={{ color: txt.primary }}>Analyze</strong> on any card to run the AI analysis without leaving the Vault.</Tip>
        </Step>

        {/* ── Done ─────────────────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${col.purple}15, ${col.teal}10)`, border: `1px solid ${col.purple}30`, borderRadius: 16, padding: '36px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: txt.primary, marginBottom: 12 }}>You&apos;re ready to go</h2>
          <p style={{ fontSize: 15, color: txt.secondary, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.7 }}>
            That&apos;s the full AdNexis workflow. Add ads → Analyze → Generate variations → Improve. Repeat until your creative converts.
          </p>
          <Link href="/signup" style={{ textDecoration: 'none', background: col.purple, color: '#fff', padding: '13px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700, display: 'inline-block' }}>
            Start for free →
          </Link>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${bg.border}`, padding: '24px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: txt.muted }}>
          AdNexis · Part of the{' '}
          <a href="https://sitenexis.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: col.teal, textDecoration: 'none' }}>SiteNexis Intelligence Suite</a>
        </p>
      </div>
    </div>
  );
}
