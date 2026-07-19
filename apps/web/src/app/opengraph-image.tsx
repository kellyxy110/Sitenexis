import { ImageResponse } from 'next/og';

export const alt = 'SiteNexis — AI Retrieval & Machine Trust Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// This route has no dynamic params, so Next.js prerenders it once at build time and
// applies its default 1-year immutable Cache-Control — `revalidate` is ignored for
// routes with nothing dynamic to revalidate. Social platforms (Facebook/Twitter/
// LinkedIn/Slack) honor that header literally and never re-scrape, so a design
// change here would never propagate. force-dynamic renders per-request instead —
// cheap for a low-traffic, scraper-only route — so Cache-Control is no longer
// Next's static-asset default.
export const dynamic = 'force-dynamic';

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
}
