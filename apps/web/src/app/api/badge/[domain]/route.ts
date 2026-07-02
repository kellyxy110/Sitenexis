export const dynamic = 'force-dynamic';
export const maxDuration = 20;

import { type NextRequest, NextResponse } from 'next/server';
import { computeQuickMTS, gradeColor } from '@/lib/quick-mts';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
): Promise<NextResponse> {
  const { domain } = await params;
  const result = await computeQuickMTS(domain);
  const score = result.quickMTS;
  const grade = result.grade;
  const color = gradeColor(grade);
  const barWidth = Math.round((score / 100) * 160);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="72" role="img" aria-label="Machine Trust Score: ${score}/100">
  <title>Machine Trust Score: ${score}/100 — ${grade}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f1f3d"/>
      <stop offset="100%" stop-color="#0A1628"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${color}99"/>
    </linearGradient>
  </defs>
  <!-- background -->
  <rect width="260" height="72" rx="10" fill="url(#bg)" stroke="#ffffff18" stroke-width="1"/>
  <!-- label row -->
  <text x="14" y="20" font-family="system-ui,sans-serif" font-size="9" font-weight="600" fill="#64748b" letter-spacing="1.2" text-anchor="start">MACHINE TRUST SCORE · SITENEXIS</text>
  <!-- score + grade -->
  <text x="14" y="44" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="${color}" text-anchor="start">${score}</text>
  <text x="52" y="44" font-family="system-ui,sans-serif" font-size="11" font-weight="400" fill="#94a3b8" text-anchor="start">/100</text>
  <text x="80" y="44" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="${color}" text-anchor="start">${grade}</text>
  <!-- bar track -->
  <rect x="14" y="54" width="160" height="6" rx="3" fill="#ffffff0f"/>
  <!-- bar fill -->
  <rect x="14" y="54" width="${barWidth}" height="6" rx="3" fill="url(#bar)"/>
  <!-- domain -->
  <text x="246" y="64" font-family="system-ui,sans-serif" font-size="9" fill="#334155" text-anchor="end">${result.domain}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=300',
    },
  });
}
