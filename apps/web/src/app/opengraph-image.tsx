import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SiteNexis — AI Retrieval & Machine Trust Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
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
          {['Machine Trust Score', 'AI Retrieval Simulation', 'Entity Intelligence', 'Citation Probability'].map((f) => (
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
}
