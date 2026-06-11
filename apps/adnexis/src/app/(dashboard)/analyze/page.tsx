'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import type { AdAnalysisResult } from '@sitenexis/analyzers/adnexis';

const PLATFORMS = ['META', 'TIKTOK', 'YOUTUBE', 'NATIVE', 'OTHER'];

export default function AnalyzePage() {
  const [transcript, setTranscript] = useState('');
  const [platform, setPlatform] = useState('META');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AdAnalysisResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    // Create ad first, then analyze
    const createRes = await fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, transcript, niche: niche || undefined }),
    });

    if (!createRes.ok) {
      setError('Failed to save ad. Please try again.');
      setLoading(false);
      return;
    }

    const ad = (await createRes.json()) as { id: string };
    setSavedId(ad.id);

    const analyzeRes = await fetch(`/api/ads/${ad.id}/analyze`, { method: 'POST' });

    if (!analyzeRes.ok) {
      setError('Analysis failed. Please try again.');
      setLoading(false);
      return;
    }

    const updated = (await analyzeRes.json()) as { analysisJson: AdAnalysisResult };
    setResult(updated.analysisJson);
    setLoading(false);
  }

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Analyze Ad</h1>
        <p className="text-text-secondary mt-1 text-sm">Paste any ad script for full AI intelligence analysis.</p>
      </div>

      <form onSubmit={handleAnalyze} className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none"
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Niche (optional)</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none placeholder-text-muted"
              placeholder="e.g. fitness, ecommerce"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Ad Script / Transcript</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            required
            rows={8}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none resize-none placeholder-text-muted"
            placeholder="Paste the full ad script, voiceover, or body copy here…"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !transcript.trim()}
          className="w-full flex items-center justify-center gap-2 bg-purple hover:bg-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Zap size={16} />
              Run Full Analysis
            </>
          )}
        </button>
      </form>

      {result && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Analysis Results</h2>
            {savedId && (
              <a href={`/vault`} className="text-xs text-purple hover:text-purple-light transition-colors">
                View in Vault →
              </a>
            )}
          </div>
          <AnalysisPanel analysis={result} transcript={transcript} />
        </div>
      )}
    </div>
  );
}
