const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const failures = [];

async function request(path, options = {}) {
  try {
    return await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...options });
  } catch (error) {
    failures.push(`${path}: request failed (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

const expectations = [
  ['/robots.txt', /^text\/plain/],
  ['/sitemap.xml', /application\/xml|text\/xml/],
  ['/llms.txt', /^text\/plain/],
  ['/ai.txt', /^text\/plain/],
  ['/.well-known/security.txt', /^text\/plain/],
  ['/humans.txt', /^text\/plain/],
  ['/rss.xml', /application\/rss\+xml|application\/xml|text\/xml/],
  ['/manifest.webmanifest', /application\/manifest\+json|application\/json/],
  ['/favicon.svg', /^image\/svg\+xml/],
  ['/og-image', /^image\/png/],
];

for (const [path, contentType] of expectations) {
  const response = await request(path);
  if (!response) continue;
  if (response.status !== 200) failures.push(`${path}: expected 200, got ${response.status}`);
  const actualType = response.headers.get('content-type') ?? '';
  if (!contentType.test(actualType)) failures.push(`${path}: unexpected content-type ${actualType}`);
  if (!response.headers.has('cache-control')) failures.push(`${path}: missing cache-control`);
}

const favicon = await request('/favicon.ico');
if (favicon && ![200, 301, 302, 307, 308].includes(favicon.status)) {
  failures.push(`/favicon.ico: expected a successful response or redirect, got ${favicon.status}`);
}
if (favicon && favicon.status >= 300 && !favicon.headers.get('location')?.endsWith('/favicon.svg')) {
  failures.push('/favicon.ico: redirect must target /favicon.svg');
}

const home = await request('/');
if (home) {
  if (home.status !== 200) failures.push(`/: expected 200, got ${home.status}`);
  const html = await home.text();
  for (const marker of ['canonical', 'og:image', 'twitter:card', 'application/ld+json']) {
    if (!html.includes(marker)) failures.push(`/: missing metadata marker ${marker}`);
  }
  for (const header of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'strict-transport-security']) {
    if (!home.headers.has(header)) failures.push(`/: missing security header ${header}`);
  }
}

const og = await request('/og-image');
if (og?.status === 200 && (og.headers.get('content-type') ?? '').startsWith('image/png')) {
  const bytes = new Uint8Array(await og.arrayBuffer());
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (width !== 1200 || height !== 630) failures.push(`/og-image: expected 1200x630, got ${width}x${height}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Public endpoint validation passed (${expectations.length + 2} endpoints plus metadata/security checks).`);
}
