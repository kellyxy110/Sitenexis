'use client';

import { ScoreRing } from '@/components/ui/ScoreRing';
import type { AdAnalysisResult } from '@sitenexis/analyzers/adnexis';

interface AnalysisPanelProps {
  analysis: AdAnalysisResult;
  transcript: string;
}

const FUNNEL_LABELS: Record<string, string> = {
  TOFU: 'Top of Funnel',
  MOFU: 'Middle of Funnel',
  BOFU: 'Bottom of Funnel',
};

export function AnalysisPanel({ analysis, transcript: _transcript }: AnalysisPanelProps) {
  const scores = [
    { label: 'Overall', score: analysis.scores.overall },
    { label: 'Hook', score: analysis.scores.hookStrength },
    { label: 'Emotion', score: analysis.scores.emotionalIntensity },
    { label: 'Novelty', score: analysis.scores.novelty },
    { label: 'Audience Fit', score: analysis.scores.audienceFit },
    { label: 'Platform', score: analysis.scores.platformFit },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Score rings */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-5">Performance Scores</h3>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {scores.map(({ label, score }) => (
            <ScoreRing key={label} score={score} label={label} size={72} strokeWidth={5} />
          ))}
        </div>
      </div>

      {/* Hook breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Hook</h3>
          <p className="text-text-primary font-medium mb-2">{analysis.hook.text}</p>
          <div className="flex gap-2">
            <span className="text-xs bg-purple/20 text-purple px-2 py-0.5 rounded-full">{analysis.hook.type}</span>
          </div>
        </div>

        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Funnel & CTA</h3>
          <p className="text-text-secondary text-xs mb-1">{FUNNEL_LABELS[analysis.funnel.stage] ?? analysis.funnel.stage}</p>
          <p className="text-text-primary font-medium mb-2">{analysis.cta.text}</p>
          <span className="text-xs bg-teal/20 text-teal px-2 py-0.5 rounded-full">{analysis.cta.type}</span>
        </div>
      </div>

      {/* Emotions */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Emotional Architecture</h3>
        <p className="text-text-secondary text-xs mb-2">Primary: <span className="text-text-primary font-medium">{analysis.emotions.primary}</span></p>
        <div className="flex flex-wrap gap-2">
          {analysis.emotions.stack.map((e) => (
            <span key={e} className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full">{e}</span>
          ))}
        </div>
      </div>

      {/* Audience */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Audience Intelligence</h3>
        <p className="text-text-primary text-sm mb-2">{analysis.audience.description}</p>
        <p className="text-text-secondary text-xs">Sophistication: <span className="text-text-primary capitalize">{analysis.audience.sophistication}</span></p>
        <p className="text-text-secondary text-xs mt-1">Pain point: <span className="text-text-primary">{analysis.audience.painPoint}</span></p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-teal">{analysis.conversionLikelihood}</p>
          <p className="text-text-secondary text-xs mt-1">Conversion Likelihood</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold capitalize ${analysis.fatigueRisk === 'low' ? 'text-teal' : analysis.fatigueRisk === 'medium' ? 'text-amber-400' : 'text-red-400'}`}>
            {analysis.fatigueRisk}
          </p>
          <p className="text-text-secondary text-xs mt-1">Fatigue Risk</p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple">{analysis.estimatedRunwayDays}d</p>
          <p className="text-text-secondary text-xs mt-1">Est. Runway</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Recommendations</h3>
        <ul className="space-y-2">
          {analysis.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-purple mt-0.5">→</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
