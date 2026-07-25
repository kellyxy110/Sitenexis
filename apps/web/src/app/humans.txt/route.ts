export const dynamic = 'force-static';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitenexis.vercel.app';

export function GET(): Response {
  const content = `/* TEAM */
Founder: Ekeleme David Kelechi
Company: SiteNexis
Contact: ${base}/contact

/* SITE */
Mission: Help websites become discoverable, understandable, retrievable, citable, and recommendable by search and AI systems.
Technology: Next.js, React, TypeScript, Tailwind CSS
Hosting: Vercel-compatible deployment
Database: PostgreSQL-compatible persistence through Prisma
License: Proprietary application; see ${base}/terms

/* NOTE */
This file intentionally excludes credentials, infrastructure identifiers, private repositories, and operational secrets.
`;
  return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
