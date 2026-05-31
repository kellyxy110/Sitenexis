import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  // Pentagon points (32px canvas, rotated so flat top)
  // Centre: 16,16 — outer radius: 13px — inner ring: 7px
  const outerR = 13;
  const innerR = 7;
  const cx = 16;
  const cy = 16;

  const outerPts = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + outerR * Math.cos(angle)},${cy + outerR * Math.sin(angle)}`;
  }).join(' ');

  const innerPts = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + innerR * Math.cos(angle)},${cy + innerR * Math.sin(angle)}`;
  }).join(' ');

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A1628',
          borderRadius: 6,
        }}
      >
        <svg width="30" height="30" viewBox="0 0 32 32">
          {/* Outer pentagon fill */}
          <polygon
            points={outerPts}
            fill="rgba(0,200,255,0.12)"
            stroke="#00C8FF"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Inner pentagon */}
          <polygon
            points={innerPts}
            fill="rgba(11,206,188,0.2)"
            stroke="rgba(11,206,188,0.6)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
