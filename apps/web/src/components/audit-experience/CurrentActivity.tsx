'use client';

const STAGE_LABELS: Record<string, string> = {
  AUDIT_STARTED: 'Starting audit',
  VALIDATING_SITE: 'Validating site',
  DISCOVERING_URLS: 'Discovering URLs',
  CRAWLING: 'Crawling site',
  EXTRACTING: 'Extracting content',
  ANALYSING_SEO: 'Analysing SEO & structure',
  ANALYSING_AI_VISIBILITY: 'Analysing AI visibility',
  ANALYSING_CITATIONS: 'Analysing citations',
  ANALYSING_INFORMATION_GAIN: 'Analysing information gain',
  ANALYSING_MACHINE_TRUST: 'Evaluating machine trust',
  ANALYSING_GOVERNANCE: 'Analysing AI governance',
  RUNNING_SCOUT: 'Running Scout intent analysis',
  BUILDING_INTELLIGENCE: 'Building intelligence report',
  GENERATING_REPORT: 'Generating report',
  COMPLETED: 'Complete',
  PARTIAL: 'Partial results',
  FAILED: 'Failed',
};

interface CurrentActivityProps {
  stage: string;
  currentActivity: string;
  currentUrl: string | null;
  reducedMotion: boolean;
}

/** Current stage/activity panel, with an aria-live region so screen readers announce meaningful stage changes. */
export function CurrentActivity({ stage, currentActivity, currentUrl, reducedMotion }: CurrentActivityProps) {
  const stageLabel = STAGE_LABELS[stage] ?? stage;

  return (
    <div
      className="relative z-10 mt-6 flex items-start gap-3 rounded-xl border border-cyan/10 bg-cyan/[0.03] px-5 py-3 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <svg
        className={`mt-0.5 h-4 w-4 shrink-0 text-cyan ${reducedMotion ? '' : 'animate-spin'}`}
        viewBox="0 0 24 24" fill="none" aria-hidden
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan/70">Current stage</div>
        <div className="text-sm font-medium text-white">{stageLabel}</div>
        <div className="mt-0.5 text-xs text-slate-500">{currentActivity}</div>
        {currentUrl && (
          <div className="mt-1 truncate text-xs text-slate-600" title={currentUrl}>
            <span className="text-[10px] uppercase tracking-widest text-slate-700">Current page: </span>
            {currentUrl}
          </div>
        )}
      </div>
    </div>
  );
}
