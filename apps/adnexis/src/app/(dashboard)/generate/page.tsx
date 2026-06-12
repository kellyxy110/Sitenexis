'use client';

import { useState } from 'react';
import { Wand2, Loader2, Copy, Check } from 'lucide-react';
import type { AdVariation } from '@sitenexis/analyzers/adnexis';

const PLATFORMS = ['META', 'TIKTOK', 'YOUTUBE', 'NATIVE'];
const TONES = [
  { value: 'aggressive', label: 'Aggressive', desc: 'Bold, urgent, direct' },
  { value: 'balanced', label: 'Balanced', desc: 'Persuasive, professional' },
  { value: 'premium', label: 'Premium', desc: 'Elevated, aspirational' },
];
const LOCALIZATIONS = [
  { value: 'none', label: 'Global (Default)' },
  { value: 'nigerian_english', label: 'Nigerian English' },
  { value: 'african_market', label: 'African Market' },
  { value: 'global_premium', label: 'Global Premium' },
];

function VariationCard({ variation }: { variation: AdVariation }) {
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-text-primary text-sm">{variation.label}</h3>
          <div className="flex gap-2 mt-1">
            <span className="text-xs bg-purple/20 text-purple px-2 py-0.5 rounded-full">{variation.platform}</span>
            <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full">{variation.hookType}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-bold text-teal">{variation.predictedScore}</span>
          <span className="text-text-muted text-xs">/100</span>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Hook</p>
          <p className="text-text-primary text-sm font-medium">{variation.hook}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">Body</p>
          <p className="text-text-secondary text-sm whitespace-pre-wrap">{variation.body}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs uppercase tracking-wide mb-0.5">CTA</p>
          <p className="text-purple text-sm font-medium">{variation.cta}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-border flex items-start justify-between gap-3">
        <p className="text-text-muted text-xs flex-1">{variation.rationale}</p>
        <button
          onClick={() => copy(`${variation.hook}\n\n${variation.body}\n\n${variation.cta}`)}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
        >
          {copied ? <Check size={12} className="text-teal" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const [sourceAd, setSourceAd] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['META']);
  const [tone, setTone] = useState('balanced');
  const [localization, setLocalization] = useState('none');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [variations, setVariations] = useState<AdVariation[]>([]);

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVariations([]);

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceAd,
        platforms: selectedPlatforms,
        tone,
        localization: localization === 'none' ? undefined : localization,
        count,
      }),
    });

    if (!res.ok) {
      setError('Generation failed. Please try again.');
      setLoading(false);
      return;
    }

    const data = (await res.json()) as { variations: AdVariation[] };
    setVariations(data.variations ?? []);
    setLoading(false);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Creative Regenerator</h1>
        <p className="text-text-secondary mt-1 text-sm">Transform any ad into platform-specific high-converting variations.</p>
      </div>

      <form onSubmit={handleGenerate} className="bg-bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Source Ad</label>
          <textarea
            value={sourceAd}
            onChange={(e) => setSourceAd(e.target.value)}
            required
            rows={6}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none resize-none placeholder-text-muted"
            placeholder="Paste the ad you want to regenerate…"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-2">Target Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  selectedPlatforms.includes(p)
                    ? 'bg-purple/20 border-purple/40 text-purple'
                    : 'bg-bg-elevated border-border text-text-secondary hover:border-border-bright'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Tone</label>
            <div className="space-y-2">
              {TONES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTone(value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    tone === value
                      ? 'bg-purple/20 border-purple/40 text-purple'
                      : 'bg-bg-elevated border-border text-text-secondary hover:border-border-bright'
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Localization</label>
            <div className="space-y-2">
              {LOCALIZATIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLocalization(value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    localization === value
                      ? 'bg-teal/20 border-teal/40 text-teal'
                      : 'bg-bg-elevated border-border text-text-secondary hover:border-border-bright'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Variations</label>
            <div className="flex flex-col gap-2">
              {[1, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    count === n
                      ? 'bg-orange/20 border-orange/40 text-orange'
                      : 'bg-bg-elevated border-border text-text-secondary hover:border-border-bright'
                  }`}
                >
                  {n} variation{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !sourceAd.trim() || selectedPlatforms.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-purple hover:bg-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Wand2 size={16} />
              Generate Variations
            </>
          )}
        </button>
      </form>

      {variations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-4">{variations.length} Variation{variations.length > 1 ? 's' : ''} Generated</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {variations.map((v, i) => (
              <VariationCard key={i} variation={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
