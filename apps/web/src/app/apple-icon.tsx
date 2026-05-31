import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const outerR = 72;
  const innerR = 40;
  const cx = 90;
  const cy = 90;

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
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A1628',
          borderRadius: 36,
        }}
      >
        <svg width="160" height="160" viewBox="0 0 180 180">
          <polygon
            points={outerPts}
            fill="rgba(0,200,255,0.14)"
            stroke="#00C8FF"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <polygon
            points={innerPts}
            fill="rgba(11,206,188,0.25)"
            stroke="rgba(11,206,188,0.7)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
