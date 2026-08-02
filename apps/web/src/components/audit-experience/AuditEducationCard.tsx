'use client';

import type { EducationCard } from './education-cards';

/** Renders one educational card. Pure presentation — content lives in education-cards.ts. */
export function AuditEducationCard({ card }: { card: EducationCard }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex w-fit items-center rounded-full border border-teal/20 bg-teal/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal">
        {card.category}
      </span>
      <h3 className="text-sm font-semibold text-white">{card.title}</h3>
      <p className="text-xs leading-relaxed text-slate-400">{card.body}</p>
      {card.learnMoreHref && (
        <a href={card.learnMoreHref} className="mt-1 w-fit text-xs font-medium text-cyan underline-offset-2 hover:underline">
          Learn more
        </a>
      )}
    </div>
  );
}
