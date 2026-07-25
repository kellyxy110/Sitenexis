const FETCH_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT = 5;

// Kept in sync with SENSITIVE_PATHS in @sitenexis/analyzers/redlab/engine —
// duplicated intentionally so the crawler package (which owns fetching) has
// no dependency on the analyzers package (which owns scoring), per the
// module boundary rules in CLAUDE.md §7.
const PATHS_TO_PROBE = [
  '/.env',
  '/.git/config',
  '/.aws/credentials',
  '/wp-config.php.bak',
  '/.htpasswd',
  '/backup.sql',
  '/.DS_Store',
  '/.svn/entries',
  '/phpinfo.php',
  '/server-status',
  '/actuator/env',
  '/.well-known/traffic-advice',
  '/wp-login.php',
  '/config.json',
];

export interface PathProbeResult {
  path: string;
  statusCode: number;
}

async function probeOne(origin: string, path: string): Promise<PathProbeResult> {
  try {
    const res = await fetch(`${origin}${path}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return { path, statusCode: res.status };
  } catch {
    return { path, statusCode: 0 };
  }
}

/**
 * Read-only GET probe against a fixed list of commonly-exposed sensitive
 * paths. Never attempts authentication, exploitation, or payload injection —
 * this simply records the HTTP status each path returns.
 */
export async function probeSensitivePaths(domain: string): Promise<PathProbeResult[]> {
  const origin = domain.startsWith('http') ? domain.replace(/\/+$/, '') : `https://${domain}`;
  const results: PathProbeResult[] = [];

  for (let i = 0; i < PATHS_TO_PROBE.length; i += MAX_CONCURRENT) {
    const batch = PATHS_TO_PROBE.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map((path) => probeOne(origin, path)));
    results.push(...batchResults);
  }

  return results;
}
