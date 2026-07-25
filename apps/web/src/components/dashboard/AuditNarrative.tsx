interface AuditNarrativeProps { finding: string; evidence: string; impact: string; nextAction: string; verify: string }

export function AuditNarrative({ finding, evidence, impact, nextAction, verify }: AuditNarrativeProps) {
  return <section className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-5">
    <p className="text-[15px] leading-7 text-slate-200">{finding}</p>
    <div className="mt-4 grid gap-3 text-xs leading-5 text-slate-400 md:grid-cols-2">
      <p><b className="text-cyan-300">Evidence:</b> {evidence}</p>
      <p><b className="text-cyan-300">Impact:</b> {impact}</p>
      <p><b className="text-cyan-300">Next action:</b> {nextAction}</p>
      <p><b className="text-cyan-300">Verify:</b> {verify}</p>
    </div>
  </section>;
}
