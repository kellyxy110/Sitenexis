import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { getAdById, saveAdAnalysis } from '@sitenexis/db';

import { analyzeAdFull } from '@sitenexis/analyzers/adnexis';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    if (!await rateLimit(`analyze:${user.id}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }
    const { id } = await params;
    const ad = await getAdById(id);

    if (!ad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (ad.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const analysis = await analyzeAdFull(
      {
        adTranscript: ad.transcript ?? '',
        platform: ad.platform,
        niche: ad.niche ?? undefined,
      },
      {
        groqApiKey: env.GROQ_API_KEY,
      }
    );

    await saveAdAnalysis(id, {
      hook: analysis.hook.text,
      hookType: analysis.hook.type,
      emotions: analysis.emotions.stack,
      funnelStage: analysis.funnel.stage,
      ctaType: analysis.cta.type,
      ctaText: analysis.cta.text,
      audience: analysis.audience.description,
      performanceScore: analysis.scores.overall,
      hookStrength: analysis.scores.hookStrength,
      emotionalIntensity: analysis.scores.emotionalIntensity,
      noveltyScore: analysis.scores.novelty,
      fatigueRisk: analysis.fatigueRisk,
      conversionLikelihood: analysis.conversionLikelihood,
      estimatedRunwayDays: analysis.estimatedRunwayDays,
      analysisJson: analysis as unknown as Record<string, unknown>,
    });

    const updated = await getAdById(id);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
