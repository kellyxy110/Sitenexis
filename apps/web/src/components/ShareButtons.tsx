'use client';

import { useState } from 'react';
import { Link2, Check, Share2 } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
  compact?: boolean;
}

export function ShareButtons({ url, title, compact = false }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
    }
  };

  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=Sitenexis`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const btnBase = compact
    ? 'flex h-8 w-8 items-center justify-center rounded-lg border transition-all'
    : 'flex h-9 w-9 items-center justify-center rounded-xl border transition-all';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 mr-1 hidden sm:block">
        Share
      </span>

      {/* X */}
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on X"
        className={`${btnBase} border-white/[0.07] bg-white/[0.03] text-slate-500 hover:border-white/[0.15] hover:text-white`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.633 5.902-5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      {/* LinkedIn */}
      <a
        href={liUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on LinkedIn"
        className={`${btnBase} border-white/[0.07] bg-white/[0.03] text-slate-500 hover:border-blue-500/30 hover:text-blue-400`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy link'}
        className={`${btnBase} border-white/[0.07] bg-white/[0.03] ${
          copied
            ? 'border-teal-500/40 text-teal-400'
            : 'text-slate-500 hover:border-teal-500/30 hover:text-teal-400'
        }`}
      >
        {copied ? <Check size={13} /> : <Link2 size={13} />}
      </button>

      {/* Native share — mobile only, shown only if Web Share API exists */}
      <button
        onClick={handleNativeShare}
        title="Share"
        className={`${btnBase} border-white/[0.07] bg-white/[0.03] text-slate-500 hover:border-white/[0.15] hover:text-white sm:hidden`}
      >
        <Share2 size={13} />
      </button>
    </div>
  );
}
