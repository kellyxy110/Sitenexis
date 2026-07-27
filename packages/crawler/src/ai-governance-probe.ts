const FETCH_TIMEOUT_MS = 5_000;

function toOrigin(domain: string): string {
  const withProtocol = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return new URL(withProtocol).origin;
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.ok || res.status === 405) return true;
    if (res.status === 404 || res.status === 403) return false;
    return false;
  } catch {
    return false;
  }
}

export interface AiGovernanceProbeResult {
  robotsTxtContent: string;
  hasLlmsTxt: boolean;
  hasAiTxt: boolean;
  hasSecurityTxt: boolean;
}

/**
 * Probes the domain's declared AI-use policy surface: robots.txt content (for the
 * Content-Signal directive and named AI bot rules) and presence of llms.txt / ai.txt /
 * security.txt. Plain fetch/HEAD requests only — no headless browser — so this is safe
 * to run from any runtime, including Vercel serverless functions.
 *
 * Pass the result to `buildAiGovernanceReport` (in `@sitenexis/analyzers`) for scoring.
 */
export async function probeAiGovernance(domain: string): Promise<AiGovernanceProbeResult> {
  const origin = toOrigin(domain);
  const [robotsTxtContent, hasLlmsTxt, hasAiTxt, hasSecurityTxt] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    exists(`${origin}/llms.txt`),
    exists(`${origin}/ai.txt`),
    exists(`${origin}/.well-known/security.txt`),
  ]);

  return { robotsTxtContent, hasLlmsTxt, hasAiTxt, hasSecurityTxt };
}
