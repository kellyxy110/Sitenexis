'use client';

import type { ModuleStatus } from '@/lib/audit-progress';

interface AuditLimitationNoticeProps {
  failedModules: ModuleStatus[];
  unavailableModules: ModuleStatus[];
}

/**
 * Explains what was limited and why — always attributing the cause to the
 * specific module/provider that fell short, never phrasing it as the
 * audited website having failed when it was SiteNexis/provider infrastructure.
 */
export function AuditLimitationNotice({ failedModules, unavailableModules }: AuditLimitationNoticeProps) {
  if (failedModules.length === 0 && unavailableModules.length === 0) return null;

  return (
    <div className="relative z-10 mt-4 w-full max-w-lg rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Limited results</p>
      <ul className="mt-1.5 space-y-1">
        {failedModules.map((m) => (
          <li key={m.id} className="text-xs text-amber-200/80">
            {m.label} could not be completed{m.detail ? ` — ${m.detail}` : ' because a required provider was unavailable'}.
          </li>
        ))}
        {unavailableModules.map((m) => (
          <li key={m.id} className="text-xs text-amber-200/80">
            {m.label} was unavailable{m.detail ? ` — ${m.detail}` : ''}.
          </li>
        ))}
      </ul>
    </div>
  );
}
