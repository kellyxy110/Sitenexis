'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Check, Loader2, Sparkles } from 'lucide-react';

type Ad = {
  id: string;
  platform: string;
  transcript: string | null;
  hook: string | null;
  hookType: string | null;
  emotions: string[];
  ctaType: string | null;
  performanceScore: number | null;
  analysisStatus: string;
};

type Comparison = {
  id: string;
  platform: string;
  hook: string | null;
  hookType: string | null;
  emotions: string[];
  ctaType: string | null;
  performanceScore: number | null;
  evidenceScore: number | null;
  analysisStatus: string;
};

type Result = {
  ads: Comparison[];
  winnerId: string | null;
  recommendation: string;
  limitations: string[];
};

export default function CampaignsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/ads?pageSize=100')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your ads.');
        const data = await response.json() as { ads?: Ad[] };
        setAds(data.ads ?? []);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load your ads.'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 12 ? [...current, id] : current);
    setResult(null);
  }

  async function compare() {
    setComparing(true);
    setError('');
    try {
      const response = await fetch('/api/campaigns/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adIds: selected }) });
      const data = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Comparison failed.');
      setResult(data);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Comparison failed.');
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-light mb-2">Campaign Intelligence</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Find the strongest creative</h1>
        <p className="text-text-secondary mt-1 text-sm max-w-2xl">Compare saved ads using completed AdNexis analyses. Recommendations are evidence-backed summaries, not claims about real-world CTR or conversion without campaign data.</p>
      </div>

      {error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h2 className="font-semibold text-text-primary">Choose ads to compare</h2><p className="text-xs text-text-secondary mt-1">Select 2–12 creatives from your vault. {selected.length} selected.</p></div>
          <button onClick={() => void compare()} disabled={selected.length < 2 || comparing} className="flex items-center gap-2 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {comparing ? <Loader2 size={15} className="animate-spin" /> : <BarChart3 size={15} />} Compare
          </button>
        </div>
        {loading ? <p className="text-sm text-text-secondary">Loading your saved ads…</p> : ads.length === 0 ? <p className="text-sm text-text-secondary">Your campaign workspace is empty. Save ads in the Swipe Vault first.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ads.map((ad) => {
              const active = selected.includes(ad.id);
              return <button key={ad.id} onClick={() => toggle(ad.id)} className={`text-left rounded-lg border p-4 transition-colors ${active ? 'border-purple bg-purple/10' : 'border-border bg-bg-elevated hover:border-purple/40'}`}>
                <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${active ? 'border-purple bg-purple text-white' : 'border-border-bright'}`}>{active && <Check size={13} />}</span><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs uppercase text-purple-light">{ad.platform}</span><span className={`text-[10px] ${ad.analysisStatus === 'complete' ? 'text-teal' : 'text-text-muted'}`}>{ad.analysisStatus === 'complete' ? 'Analyzed' : 'Needs analysis'}</span></div><p className="mt-1 line-clamp-2 text-sm text-text-primary">{ad.hook ?? ad.transcript ?? 'Untitled ad'}</p></div></div>
              </button>;
            })}
          </div>
        )}
      </div>

      {result && <div className="space-y-4">
        <div className="rounded-xl border border-purple/30 bg-purple/10 p-4 sm:p-6"><div className="flex items-center gap-2 text-purple-light text-xs font-semibold uppercase tracking-wide mb-2"><Sparkles size={14} /> Intelligence readout</div><p className="text-sm leading-6 text-text-primary">{result.recommendation}</p></div>
        {result.limitations.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"><p className="font-semibold mb-1">Evidence limits</p>{result.limitations.map((item) => <p key={item}>• {item}</p>)}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{result.ads.map((ad) => <div key={ad.id} className={`rounded-xl border bg-bg-card p-5 ${ad.id === result.winnerId ? 'border-teal/60' : 'border-border'}`}><div className="flex justify-between gap-3"><div><span className="text-xs uppercase text-purple-light">{ad.platform}</span><h3 className="mt-1 font-semibold text-text-primary">{ad.hook ?? 'No hook extracted'}</h3></div>{ad.id === result.winnerId && <span className="text-xs text-teal font-semibold">Recommended</span>}</div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-lg font-bold text-text-primary">{ad.evidenceScore ?? '—'}</p><p className="text-[10px] text-text-muted">Evidence score</p></div><div><p className="text-sm font-medium text-text-primary">{ad.hookType ?? '—'}</p><p className="text-[10px] text-text-muted">Hook</p></div><div><p className="text-sm font-medium text-text-primary">{ad.ctaType ?? '—'}</p><p className="text-[10px] text-text-muted">CTA</p></div></div></div>)}</div>
      </div>}
    </div>
  );
}
