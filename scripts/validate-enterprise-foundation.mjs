import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This validator intentionally uses only Node's standard library. It does not
// spawn a shell, package manager, browser, or platform-specific child process.
// Resolve from the script location so it works from any cwd on Windows, Linux,
// and macOS (for example: `node scripts/validate-enterprise-foundation.mjs`).
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const webRoot = path.join(root, 'apps', 'web');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const failures = [];

const required = [
  'apps/web/src/app/robots.ts',
  'apps/web/src/app/sitemap.ts',
  'apps/web/src/app/llms.txt/route.ts',
  'apps/web/src/app/ai.txt/route.ts',
  'apps/web/src/app/.well-known/security.txt/route.ts',
  'apps/web/src/app/humans.txt/route.ts',
  'apps/web/src/app/rss.xml/route.ts',
  'apps/web/src/app/manifest.webmanifest/route.ts',
  'apps/web/public/favicon.svg',
  'apps/web/src/app/favicon.ico/route.ts',
  'apps/web/src/app/og-image/route.tsx',
];

for (const file of required) {
  if (!exists(file)) failures.push(`missing ${file}`);
}

const robots = read('apps/web/src/app/robots.ts');
const crawlers = [
  'Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'anthropic-ai', 'Google-Extended',
  'PerplexityBot', 'Applebot', 'Applebot-Extended', 'CCBot', 'Diffbot',
  'Bytespider', 'cohere-ai', 'MistralAI', 'Amazonbot', 'Meta-ExternalAgent',
];
for (const crawler of crawlers) {
  if (!robots.includes(crawler)) failures.push(`robots missing ${crawler}`);
}
for (const privatePath of ['/dashboard/', '/api/', '/audit/', '/auth/']) {
  if (!robots.includes(privatePath)) failures.push(`robots missing private exclusion ${privatePath}`);
}
if (!robots.includes('NEXT_PUBLIC_APP_URL')) failures.push('robots has no configurable canonical base');

const sitemap = read('apps/web/src/app/sitemap.ts');
if (/lastModified:\s*new Date\(\)/.test(sitemap)) failures.push('sitemap uses request-time lastModified');
if (!sitemap.includes('sitenexis.vercel.app')) failures.push('sitemap has no canonical deployment fallback');
if (!sitemap.includes('NEXT_PUBLIC_APP_URL')) failures.push('sitemap has no configurable canonical base');
if (exists('apps/web/public/llms.txt')) failures.push('duplicate public llms.txt remains');

const plainTextRoutes = [
  'apps/web/src/app/llms.txt/route.ts',
  'apps/web/src/app/ai.txt/route.ts',
  'apps/web/src/app/.well-known/security.txt/route.ts',
  'apps/web/src/app/humans.txt/route.ts',
];
for (const file of plainTextRoutes) {
  const source = read(file);
  if (!source.includes('text/plain; charset=utf-8')) failures.push(`${file} lacks UTF-8 text content type`);
  if (!source.includes('Cache-Control')) failures.push(`${file} lacks cache policy`);
}

const security = read('apps/web/src/app/.well-known/security.txt/route.ts');
for (const field of ['Contact:', 'Policy:', 'Canonical:', 'Expires:', 'Preferred-Languages:']) {
  if (!security.includes(field)) failures.push(`security.txt missing ${field}`);
}
const expiresMatch = security.match(/Expires:\s*([^\n]+)/);
if (!expiresMatch || Number.isNaN(Date.parse(expiresMatch[1])) || Date.parse(expiresMatch[1]) <= Date.now()) {
  failures.push('security.txt Expires must be a valid future date');
}

const rss = read('apps/web/src/app/rss.xml/route.ts');
if (!rss.includes('application/rss+xml')) failures.push('rss.xml lacks RSS content type');
for (const requiredTag of ['<rss version="2.0">', '<channel>', '<item>', '<pubDate>']) {
  if (!rss.includes(requiredTag)) failures.push(`rss.xml source missing ${requiredTag}`);
}

const manifest = read('apps/web/src/app/manifest.webmanifest/route.ts');
for (const field of ["name:", "short_name:", "start_url:", "display:", "icons:"]) {
  if (!manifest.includes(field)) failures.push(`manifest source missing ${field}`);
}
if (!manifest.includes('application/manifest+json')) failures.push('manifest lacks manifest content type');

const nextConfig = read('apps/web/next.config.ts');
for (const header of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy']) {
  if (!nextConfig.includes(header)) failures.push(`next.config.ts lacks ${header} security/cache policy`);
}
if (nextConfig.includes("'unsafe-eval'") && !nextConfig.includes("NODE_ENV === 'development'")) {
  failures.push('production CSP still contains unsafe-eval');
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Enterprise foundation validation passed (${required.length} resources, ${crawlers.length} crawler identities, and source policy checks).`);
}
