import Link from 'next/link';

function PentagonMark({ size = 20 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
      <polygon
        points={pts}
        stroke="rgba(11,206,188,0.35)"
        strokeWidth="0.6"
        fill="none"
        style={{ transform: `scale(0.55) translate(${size * 0.45}px, ${size * 0.45}px)` }}
      />
    </svg>
  );
}

const COLUMNS: { heading: string; links: [string, string][] }[] = [
  {
    heading: 'Product',
    links: [['Platform', '/platform'], ['Pricing', '/pricing'], ['Methodology', '/methodology'], ['Changelog', '/changelog']],
  },
  {
    heading: 'Developers',
    links: [['Docs', '/docs'], ['Blog', '/blog'], ['Sitemap', '/sitemap-html']],
  },
  {
    heading: 'Company',
    links: [['About', '/about'], ['Founder', '/founder'], ['Press & Media', '/press'], ['Contact', '/contact']],
  },
  {
    heading: 'Legal',
    links: [
      ['Privacy Policy', '/privacy'],
      ['Terms of Service', '/terms'],
      ['Cookie Policy', '/cookie-policy'],
      ['Acceptable Use', '/acceptable-use'],
      ['AI Data Disclosure', '/ai-disclosure'],
      ['Disclaimer', '/disclaimer'],
      ['Copyright', '/copyright'],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.05] bg-[#07111F] px-6 py-16">
      <div className="mx-auto max-w-7xl md:px-4">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03]">
                <PentagonMark size={16} />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-white">SiteNexis</span>
            </Link>
            <p className="mt-3 text-[13px] leading-relaxed text-[#334155]">
              AI Retrieval + Machine Trust Intelligence Platform.
              <br />
              Built for the machine-first web.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://x.com/Sitenexis"
                target="_blank"
                rel="noopener noreferrer"
                title="SiteNexis on X"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] text-[#475569] transition-colors hover:border-white/[0.15] hover:text-white"
              >
                𝕏
              </a>
              <a
                href="mailto:sitenexisintel@gmail.com"
                title="Email SiteNexis"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] text-[#475569] transition-colors hover:border-teal-500/30 hover:text-teal-400"
              >
                @
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-12 text-[13px]">
            {COLUMNS.map(({ heading, links }) => (
              <div key={heading}>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#334155]">{heading}</p>
                <ul className="space-y-3">
                  {links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="text-[#475569] transition-colors duration-150 hover:text-[#94A3B8]">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.04] pt-8 md:flex-row">
          <p className="text-[12px] text-[#1E293B]">© {new Date().getFullYear()} SiteNexis. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[12px] text-[#1E293B]">
            <a href="https://x.com/Sitenexis" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#475569]">@Sitenexis</a>
            <a href="mailto:sitenexisintel@gmail.com" className="transition-colors hover:text-[#475569]">sitenexisintel@gmail.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
