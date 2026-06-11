'use client';

import { useState } from 'react';
import { Zap, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { cn } from '@/lib/utils';

interface AdCardProps {
  ad: {
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
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  META: 'text-blue-400 bg-blue-400/10',
  TIKTOK: 'text-pink-400 bg-pink-400/10',
  YOUTUBE: 'text-red-400 bg-red-400/10',
  NATIVE: 'text-amber-400 bg-amber-400/10',
  OTHER: 'text-text-secondary bg-bg-elevated',
};

const FATIGUE_COLORS: Record<string, string> = {
  low: 'text-teal bg-teal/10',
  medium: 'text-amber-400 bg-amber-400/10',
  high: 'text-red-400 bg-red-400/10',
};

export function AdCard({ ad, onDelete, onAnalyze }: AdCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const analyzed = ad.analysisStatus === 'complete';

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/ads/${ad.id}`, { method: 'DELETE' });
    if (res.ok) onDelete?.(ad.id);
    else setDeleting(false);
  }

  return (
    <div className="bg-bg-card border border-border hover:border-border-bright rounded-xl p-5 transition-all shadow-card animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', PLATFORM_COLORS[ad.platform] ?? PLATFORM_COLORS['OTHER'])}>
            {ad.platform}
          </span>
          {ad.hookType && (
            <span className="text-xs text-purple bg-purple/10 px-2 py-0.5 rounded-full font-medium">
              {ad.hookType}
            </span>
          )}
          {ad.fatigueRisk && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', FATIGUE_COLORS[ad.fatigueRisk] ?? '')}>
              {ad.fatigueRisk} fatigue
            </span>
          )}
        </div>
        {analyzed && ad.performanceScore !== null && (
          <ScoreRing score={ad.performanceScore} size={48} strokeWidth={4} />
        )}
      </div>

      {/* Hook */}
      {ad.hook ? (
        <p className="text-text-primary text-sm font-medium mb-2 line-clamp-2">{ad.hook}</p>
      ) : (
        <p className="text-text-secondary text-sm italic mb-2 line-clamp-2">{ad.transcript?.slice(0, 120)}…</p>
      )}

      {/* Tags */}
      {ad.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {ad.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-xs text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}

      {/* Expanded transcript */}
      {expanded && ad.transcript && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-text-secondary text-xs whitespace-pre-wrap">{ad.transcript}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          {!analyzed && (
            <button
              onClick={() => onAnalyze?.(ad.id)}
              className="flex items-center gap-1.5 text-xs bg-purple/20 hover:bg-purple/30 text-purple px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <Zap size={12} />
              Analyze
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less' : 'Transcript'}
          </button>
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
