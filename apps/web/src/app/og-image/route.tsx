export const dynamic = 'force-dynamic';
import { ImageResponse } from 'next/og';

const size = { width: 1200, height: 630 };

/**
 * Custom OG image route — NOT the opengraph-image.tsx special-file convention.
 * That convention hardcodes a 1-year immutable Cache-Control on its Response
 * regardless of revalidate/dynamic route config (verified live: both were tried
 * and neither changed the served header). A plain Route Handler returns its
 * Response exactly as constructed, so this is the only reliable way to control
 * OG image caching in this Next.js version.
 */
export async function GET(): Promise<Response> {
  const image = new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0A1628 0%, #050B09 55%, #071820 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '72px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, color: '#00C8FF', letterSpacing: '0.25em', marginBottom: 28 }}>
          SITENEXIS
        </div>
        <div style={{ fontSize: 54, fontWeight: 800, color: '#ffffff', textAlign: 'center', lineHeight: 1.15, marginBottom: 24, maxWidth: 920 }}>
          AI Retrieval &amp; Machine Trust Intelligence
        </div>
        <div style={{ fontSize: 22, color: '#6B8FA3', textAlign: 'center', maxWidth: 760, lineHeight: 1.5 }}>
          Model how AI systems retrieve, interpret, trust, and recommend your website — across every layer of the intelligence stack
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 44 }}>
          {['Intelligence Report', 'Decision Roadmap', 'Machine Trust Score', 'Retrieval Simulation', 'Entity Intelligence'].map((f) => (
            <div
              key={f}
              style={{
                background: 'rgba(0, 200, 255, 0.07)',
                border: '1px solid rgba(0, 200, 255, 0.22)',
                borderRadius: 24,
                padding: '7px 18px',
                fontSize: 15,
                color: '#0BCEBC',
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );

  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, must-revalidate',
    },
  });
}
