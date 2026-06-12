'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[audit error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050B09] px-6">
      {/* Logo */}
      <Link href="/dashboard" className="mb-10 text-2xl font-bold text-white tracking-tight">
        Site<span className="text-cyan">Nexis</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1628]/60 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mx-auto">
          <span className="text-red-400 text-xl">⚠</span>
        </div>
        <h1 className="mb-2 text-lg font-bold text-white">Something went wrong</h1>
        <p className="mb-6 text-sm text-[#4A6280] leading-relaxed">
          {error?.message && error.message !== 'An unexpected error occurred'
            ? error.message
            : 'A client-side error occurred while loading the audit results.'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full rounded-lg bg-cyan px-4 py-2.5 text-sm font-semibold text-navy hover:bg-teal transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-[#4A6280] hover:text-white hover:border-white/20 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
