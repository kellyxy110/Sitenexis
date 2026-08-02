'use client';

import { useEffect, useMemo, useState } from 'react';
import { EDUCATION_CARDS } from './education-cards';
import { AuditEducationCard } from './AuditEducationCard';

const ROTATE_MS = 9_000;

/** Deterministically shuffles once per mount so repeated audits don't always open on the same card. */
function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

interface AuditEducationCarouselProps {
  reducedMotion: boolean;
}

export function AuditEducationCarousel({ reducedMotion }: AuditEducationCarouselProps) {
  const cards = useMemo(() => shuffled(EDUCATION_CARDS), []);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % cards.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, cards.length]);

  if (cards.length === 0) return null;
  const card = cards[index]!;

  return (
    <div
      className="relative z-10 mt-5 w-full max-w-lg rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div key={card.id} className={reducedMotion ? '' : 'animate-[fadeIn_0.5s_ease-out]'}>
        <AuditEducationCard card={card} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-slate-600">{index + 1} / {cards.length}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous card"
            onClick={() => setIndex((i) => (i - 1 + cards.length) % cards.length)}
            className="rounded p-1 text-slate-600 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next card"
            onClick={() => setIndex((i) => (i + 1) % cards.length)}
            className="rounded p-1 text-slate-600 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            ›
          </button>
        </div>
      </div>

      {!reducedMotion && (
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      )}
    </div>
  );
}
