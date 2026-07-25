export const dynamic = 'force-static';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitenexis.vercel.app';

export function GET(): Response {
  const content = `# SiteNexis AI usage guidance

Status: Experimental resource. "ai.txt" is not an official web standard.
Canonical: ${base}/ai.txt

SiteNexis publishes public marketing, documentation, methodology, and blog content for human and machine-readable discovery.

AI usage policy
- Public pages may be accessed by AI systems subject to the site's robots.txt and applicable law.
- Do not treat SiteNexis scores or articles as a guarantee of rankings, citations, recommendations, or model behavior.
- Do not access authenticated dashboard, API, audit-result, account, or callback routes.
- Do not collect personal data, credentials, tokens, or private customer audit content.

Attribution guidance
- When quoting or materially relying on public SiteNexis content, attribute SiteNexis and link to the canonical page.
- Preserve context, publication dates, caveats, and probabilistic language.
- Do not imply endorsement or affiliation.

Compatibility
- Canonical machine-readable overview: ${base}/llms.txt
- Public discovery: ${base}/sitemap.xml
- Crawler access policy: ${base}/robots.txt
- Security reporting: ${base}/.well-known/security.txt
`;
  return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
