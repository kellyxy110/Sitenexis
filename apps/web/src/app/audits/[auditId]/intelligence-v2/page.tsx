'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type {
  CanonicalScorePlaceholder,
  EvidenceContradiction,
  IntelligenceReportV2Delivery,
  IntelligenceReportV2Opportunity,
  IntelligenceReportV2Recommendation,
  IntelligenceModuleExecutionSummary,
  ProviderAvailability,
  RootCauseGroup,
} from '@sitenexis/shared';
import { isVerificationState } from '@sitenexis/shared';
import {
  buildCategoryExplanation,
  confidenceLabelFor,
  isLikelyIntelligenceReportV2Delivery,
  verificationStateLabel,
  type CategoryExplanation,
} from '@/lib/intelligence-report-v2-view-model';

async function fetchDelivery(auditId: string): Promise<IntelligenceReportV2Delivery> {
  const response = await fetch(`/api/audits/${auditId}/intelligence-report-v2`);
  if (!response.ok) throw new Error('Unable to load Intelligence Report v2');
  const payload: unknown = await response.json();
  if (!isLikelyIntelligenceReportV2Delivery(payload)) {
    throw new Error('The server returned an unexpected report shape.');
  }
  return payload;
}

const overallStateLabel = (label: string, score: number | null): string =>
  score === null ? label.replace(/_/g, ' ') : `${score} · ${label}`;

export default function IntelligenceV2Page() {
  const params = useParams<{ auditId: string }>();
  const query = useQuery<IntelligenceReportV2Delivery>({
    queryKey: ['intelligence-v2', params.auditId],
    queryFn: () => fetchDelivery(params.auditId),
  });

  if (query.isLoading) {
    return <main className="min-h-screen bg-[#050B09] p-8 text-white">Loading Intelligence Report v2…</main>;
  }
  if (query.error || !query.data) {
    return <main className="min-h-screen bg-[#050B09] p-8 text-red-300" role="alert">{(query.error as Error)?.message ?? 'Unable to load this report.'}</main>;
  }

  const delivery = query.data;
  const { report } = delivery;

  return (
    <main className="min-h-screen bg-[#050B09] text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-8">
        <header className="rounded-2xl border border-white/10 bg-white/[.03] p-6">
          <p className="text-xs uppercase tracking-widest text-cyan">Intelligence Report v2</p>
          <h1 className="mt-2 text-2xl font-bold">{report.identity.domain}</h1>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6">
            {[
              ['Overall', delivery.overall.overallScore ?? '—'],
              ['Grade', delivery.overall.grade ?? 'Unavailable'],
              ['Confidence', confidenceLabelFor(delivery.overall.overallConfidence)],
              ['Coverage', delivery.overall.observedCoverage == null ? 'Unknown' : `${Math.round(delivery.overall.observedCoverage * 100)}%`],
              ['Measured weight', `${Math.round(delivery.overall.measuredWeightCoverage * 100)}%`],
              ['Method', delivery.overall.methodologyVersion],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-black/20 p-3">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-1 font-semibold">{String(value)}</div>
              </div>
            ))}
          </div>
        </header>

        <section aria-labelledby="scorecard-heading">
          <h2 id="scorecard-heading" className="mb-3 text-xl font-semibold">25-Category Scorecard</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.scores.map((score) => (
              <CategoryCard key={score.category} score={score} report={report} />
            ))}
          </div>
        </section>

        <Grid title="Contradictions" items={report.contradictions} render={(item: EvidenceContradiction) => (
          <>
            <p className="font-semibold">{item.subject}</p>
            <p className="mt-1 text-sm text-slate-300">{item.type.replace(/_/g, ' ').toLowerCase()} · {item.resolutionStatus.replace(/_/g, ' ').toLowerCase()}</p>
          </>
        )} />

        <Grid title="Root Causes" items={report.rootCauses} render={(item: RootCauseGroup) => (
          <>
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-slate-300">{item.groupingReason}</p>
          </>
        )} />

        <Grid title="Module Status" items={report.moduleStatus} render={(item: IntelligenceModuleExecutionSummary) => (
          <>
            <p className="font-semibold">{item.moduleId}</p>
            <p className="mt-1 text-sm text-slate-300">{item.state.replace(/_/g, ' ').toLowerCase()}{item.reason ? `: ${item.reason}` : ''}</p>
          </>
        )} emptyMessage="No stored module execution state is available for this audit." />

        <Grid title="Provider Status" items={report.providers} render={(item: ProviderAvailability) => (
          <>
            <p className="font-semibold">{item.provider}</p>
            <p className="mt-1 text-sm text-slate-300">{item.available ? 'Available' : `Measurement unavailable${item.reason ? ` — ${item.reason}` : ''}`}</p>
          </>
        )} />

        <Grid title="Recommendations" items={delivery.recommendations} render={(item: IntelligenceReportV2Recommendation) => (
          <>
            <p className="font-semibold">{item.priority}: {item.title}</p>
            <p className="mt-1 text-sm text-slate-300">{item.suggestedTimeframe.replace(/_/g, ' ').toLowerCase()} · {isVerificationState(item.verificationState) ? verificationStateLabel(item.verificationState) : item.verificationState}</p>
          </>
        )} />

        <Grid title="Strategic Opportunities" items={delivery.opportunities} render={(item: IntelligenceReportV2Opportunity) => (
          <>
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-slate-300">{item.whyOpportunity}</p>
          </>
        )} />

        <section aria-labelledby="narrative-heading">
          <h2 id="narrative-heading" className="mb-3 text-xl font-semibold">Evidence-backed Narrative</h2>
          <div className="space-y-3">
            {delivery.narrative.sections.map((section) => (
              <article key={section.id} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <h3 className="font-semibold">{section.title}</h3>
                {section.body.map((paragraph, index) => (
                  <p className="mt-2 text-sm text-slate-300" key={index}>{paragraph}</p>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4" aria-labelledby="limitations-heading">
          <h2 id="limitations-heading" className="font-semibold">Methodology &amp; Limitations</h2>
          {delivery.overall.limitations.map((limitation) => (
            <p key={limitation} className="mt-1 text-sm text-slate-300">{limitation}</p>
          ))}
        </section>
      </div>
    </main>
  );
}

// ─── Category card: the full "Why This Score?" explanation ────────────────

function CategoryCard({ score, report }: { score: CanonicalScorePlaceholder; report: IntelligenceReportV2Delivery['report'] }) {
  const explanation = buildCategoryExplanation(score, report);
  return (
    <details className="rounded-xl border border-white/10 bg-white/[.03] p-4">
      <summary className="flex cursor-pointer list-none justify-between gap-3">
        <span>{explanation.category}</span>
        <strong>{overallStateLabel(explanation.statusLabel, explanation.score)}</strong>
      </summary>
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <p>
          Weight: {explanation.weight ?? '—'} · {explanation.confidenceLabel} · {explanation.coverageLabel}
        </p>

        {explanation.status === 'UNAVAILABLE' || explanation.status === 'INSUFFICIENT_EVIDENCE' || explanation.status === 'NOT_APPLICABLE' ? (
          <p className="rounded-lg bg-black/20 p-3 text-slate-200">
            {explanation.unavailableReason ?? `This category is ${explanation.statusLabel.toLowerCase()} — no numeric score is shown.`}
          </p>
        ) : (
          <ScoreBreakdown explanation={explanation} />
        )}

        {explanation.diagnostics.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Diagnostics</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {explanation.diagnostics.map((diagnostic, index) => <li key={index}>{diagnostic}</li>)}
            </ul>
          </div>
        )}

        {explanation.confidenceReasons.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Confidence reasons</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {explanation.confidenceReasons.map((reason, index) => <li key={index}>{reason}</li>)}
            </ul>
          </div>
        )}

        <SupportingDetails explanation={explanation} />
      </div>
    </details>
  );
}

function ScoreBreakdown({ explanation }: { explanation: CategoryExplanation }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why this score</h3>
      <dl className="mt-1 divide-y divide-white/5">
        <BreakdownRow label="Baseline" value={explanation.baseline} />
        {explanation.adjustments.map((adjustment, index) => (
          <BreakdownRow key={index} label={adjustment.label} value={adjustment.amount} detail={adjustment.detail} signed />
        ))}
        <BreakdownRow label="Pre-clamp score" value={explanation.preClampScore} />
        <BreakdownRow label="Final score" value={explanation.finalScore} emphasize />
      </dl>
      {!explanation.traceAvailable && (
        <p className="mt-2 text-xs text-slate-500">A detailed contribution trace is not available for this category.</p>
      )}
    </div>
  );
}

function BreakdownRow({ label, value, detail, signed, emphasize }: { label: string; value: number | null; detail?: string | undefined; signed?: boolean; emphasize?: boolean }) {
  const formatted = value === null ? '—' : signed && value > 0 ? `+${value}` : String(value);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
      <dt className={emphasize ? 'font-semibold text-white' : ''}>{label}</dt>
      <dd className={`tabular-nums ${emphasize ? 'font-semibold text-white' : ''}`}>{formatted}</dd>
      {detail && <p className="basis-full text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function SupportingDetails({ explanation }: { explanation: CategoryExplanation }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DetailList title="Affected URLs" items={explanation.affectedUrls} empty="No page-specific URLs are attached to this category." />
      <DetailList
        title="Supporting evidence"
        items={explanation.supportingEvidence.map((item) => `${item.title}${item.url ? ` (${item.url})` : ''} — ${verificationStateLabel(item.verificationState)}`)}
        empty="No supporting evidence is attached to this category."
      />
      <DetailList title="Contradictions" items={explanation.contradictions.map((item) => `${item.subject}: ${item.type.replace(/_/g, ' ').toLowerCase()}`)} empty="No contradictions affect this category." />
      <DetailList title="Root causes" items={explanation.rootCauses.map((item) => item.title)} empty="No root cause affects this category." />
    </div>
  );
}

function DetailList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {items.map((item, index) => <li key={index} className="break-words">{item}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-slate-500">{empty}</p>
      )}
    </div>
  );
}

// ─── Generic list section (contradictions/root causes/module+provider status/recommendations/opportunities) ────

function Grid<T>({ title, items, render, emptyMessage }: { title: string; items: readonly T[]; render: (item: T) => ReactNode; emptyMessage?: string }) {
  const headingId = `${title.toLowerCase().replace(/[^a-z]+/g, '-')}-heading`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.length ? items.map((item, index) => (
          <article key={index} className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-300">
            {render(item)}
          </article>
        )) : (
          <p className="text-sm text-slate-400">{emptyMessage ?? `No supplied ${title.toLowerCase()}.`}</p>
        )}
      </div>
    </section>
  );
}
