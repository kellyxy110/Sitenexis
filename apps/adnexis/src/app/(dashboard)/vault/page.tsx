'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { AdCard } from '@/components/vault/AdCard';
import { AddAdModal } from '@/components/vault/AddAdModal';
import { SkeletonGrid } from '@/components/ui/SkeletonCard';

const PLATFORMS = ['ALL', 'META', 'TIKTOK', 'YOUTUBE', 'NATIVE', 'OTHER'];
const HOOK_TYPES = ['ALL', 'curiosity', 'shock', 'authority', 'story', 'fear', 'transformation'];

type Ad = {
  id: string;
  platform: string;
  transcript: string | null;
  hook: string | null;
  hookType: string | null;
  performanceScore: number | null;
  fatigueRisk: string | null;
  analysisStatus: string;
  niche: string | null;
  tags: string[];
  createdAt: string;
};

export default function VaultPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('ALL');
  const [hookType, setHookType] = useState('ALL');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform !== 'ALL') params.set('platform', platform);
    if (hookType !== 'ALL') params.set('hookType', hookType);
    const res = await fetch(`/api/ads?${params}`);
    if (res.ok) {
      const data = (await res.json()) as { ads: Ad[] };
      setAds(data.ads ?? []);
    }
    setLoading(false);
  }, [platform, hookType]);

  useEffect(() => { void fetchAds(); }, [fetchAds]);

  async function handleAnalyze(id: string) {
    setAnalyzingId(id);
    const res = await fetch(`/api/ads/${id}/analyze`, { method: 'POST' });
    if (res.ok) {
      const updated = (await res.json()) as Ad;
      setAds((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    }
    setAnalyzingId(null);
  }

  const filtered = ads.filter((ad) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (ad.transcript ?? '').toLowerCase().includes(q) ||
      (ad.hook ?? '').toLowerCase().includes(q) ||
      (ad.niche ?? '').toLowerCase().includes(q) ||
      ad.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Swipe Vault</h1>
          <p className="text-text-secondary mt-1 text-sm">{ads.length} ads saved</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple hover:bg-purple-light text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Ad
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ads…"
            className="w-full bg-bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-purple focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-purple focus:outline-none"
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{p === 'ALL' ? 'All Platforms' : p}</option>)}
          </select>
          <select
            value={hookType}
            onChange={(e) => setHookType(e.target.value)}
            className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-purple focus:outline-none"
          >
            {HOOK_TYPES.map((h) => <option key={h} value={h}>{h === 'ALL' ? 'All Hooks' : h}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonGrid count={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-secondary mb-4">
            {ads.length === 0 ? 'No ads in your vault yet.' : 'No ads match your search.'}
          </p>
          {ads.length === 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-purple/20 hover:bg-purple/30 text-purple px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Add your first ad
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ad) => (
            <AdCard
              key={ad.id}
              ad={{ ...ad, createdAt: ad.createdAt }}
              onDelete={(id) => setAds((prev) => prev.filter((a) => a.id !== id))}
              onAnalyze={analyzingId === ad.id ? undefined : handleAnalyze}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddAdModal
          onClose={() => setShowModal(false)}
          onAdded={(ad) => {
            setAds((prev) => [ad as Ad, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
