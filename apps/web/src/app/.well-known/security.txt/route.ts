export const dynamic = 'force-static';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitenexis.vercel.app';

export function GET(): Response {
  const content = `Contact: mailto:sitenexisintel@gmail.com
Policy: ${base}/contact#security
Acknowledgments: ${base}/contact#security-acknowledgments
Canonical: ${base}/.well-known/security.txt
Expires: 2027-07-25T00:00:00.000Z
Preferred-Languages: en
Hiring: ${base}/contact#careers
`;
  return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
