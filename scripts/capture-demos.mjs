import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'https://sitenexis.vercel.app';
const OUT = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'demos');

const demos = [
  { domain: 'genshipyard.com',        file: 'genshipyard.png' },
  { domain: 'alwajudproperties.com',   file: 'alwajudproperties.png' },
  { domain: 'inforsphere.com',         file: 'inforsphere.png' },
  { domain: 'community.genhub.fun',    file: 'communitygenhub.png' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const { domain, file } of demos) {
    const page = await ctx.newPage();
    const url = `${BASE}/audit/${encodeURIComponent(domain)}?demo=true`;
    console.log(`Capturing ${domain} from ${url}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      // Wait for data to fully render
      await page.waitForTimeout(3000);

      const outPath = join(OUT, file);
      await page.screenshot({ path: outPath, type: 'png', fullPage: false });
      console.log(`  ✓ Saved ${outPath}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('Done!');
}

main();
