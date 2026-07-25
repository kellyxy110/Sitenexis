'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

interface ToolExplanationProps { what: string; why: string; checks: string; improve: string }

export function ToolExplanation({ what, why, checks, improve }: ToolExplanationProps) {
  const [open, setOpen] = useState(false);
  return <div className="relative inline-flex">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label="What this means" className="text-slate-500 hover:text-cyan-300"><Info size={15} /></button>
    {open && <div role="dialog" className="absolute left-0 top-7 z-20 w-80 rounded-xl border border-white/[0.1] bg-[#0b1425] p-4 text-left shadow-2xl">
      <p className="text-xs leading-5 text-slate-300"><b className="text-white">What it is:</b> {what}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300"><b className="text-white">Why it matters:</b> {why}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300"><b className="text-white">SiteNexis checks:</b> {checks}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300"><b className="text-white">How to improve:</b> {improve}</p>
    </div>}
  </div>;
}
