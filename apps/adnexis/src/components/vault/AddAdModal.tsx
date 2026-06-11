'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddAdModalProps {
  onClose: () => void;
  onAdded: (ad: unknown) => void;
}

const PLATFORMS = ['META', 'TIKTOK', 'YOUTUBE', 'NATIVE', 'OTHER'];

export function AddAdModal({ onClose, onAdded }: AddAdModalProps) {
  const [platform, setPlatform] = useState('META');
  const [transcript, setTranscript] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [niche, setNiche] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        transcript,
        sourceUrl: sourceUrl || undefined,
        niche: niche || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      }),
    });

    if (!res.ok) {
      setError('Failed to add ad. Please try again.');
      setLoading(false);
      return;
    }

    const ad: unknown = await res.json();
    onAdded(ad);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-card animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">Add Ad to Vault</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm text-text-secondary mb-1.5">Ad Script / Transcript <span className="text-red-400">*</span></label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              required
              rows={5}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none resize-none placeholder-text-muted"
              placeholder="Paste the ad script, voiceover, or body copy…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Niche</label>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none placeholder-text-muted"
                placeholder="e.g. ecommerce"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Source URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none placeholder-text-muted"
                placeholder="https://…"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-purple focus:outline-none placeholder-text-muted"
              placeholder="urgency, testimonial, before-after"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-border-bright py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple hover:bg-purple-light disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Adding…' : 'Add to Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
