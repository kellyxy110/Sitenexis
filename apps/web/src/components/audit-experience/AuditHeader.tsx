'use client';

interface AuditHeaderProps {
  domain: string;
  failed: boolean;
  errorMessage: string | null;
  reducedMotion: boolean;
}

/** Domain title + live/failed status badge. Semantic h1 so screen readers announce the page subject. */
export function AuditHeader({ domain, failed, errorMessage, reducedMotion }: AuditHeaderProps) {
  return (
    <div className="relative z-10 mb-8 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 backdrop-blur-sm">
        {!failed && (
          <span className="relative flex h-2 w-2">
            {!reducedMotion && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
          </span>
        )}
        {failed && <span aria-hidden className="h-2 w-2 rounded-full bg-red-500" />}
        <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
          {failed ? 'Audit Failed' : 'AI Visibility Intelligence Audit'}
        </span>
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{domain}</h1>
      {failed && errorMessage && (
        <p role="alert" className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2 text-sm text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
