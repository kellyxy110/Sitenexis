import type { CrawledPage, SEOScore } from '@sitenexis/shared';

export interface AiCrawlabilityResult {
  score: number;
  breakdown: {
    robots: number;
    sitemap: number;
    renderability: number;
    indexability: number;
  };
}

const BLOCKING_DIRECTIVES = ['noindex', 'noimageindex', 'none'];
const AI_BLOCKING_DIRECTIVES = ['noai', 'noimageai', 'aigooglegoog', 'gptbot'];

export function computeAiCrawlability(
  pages: CrawledPage[],
  seo: SEOScore,
): AiCrawlabilityResult {
  if (pages.length === 0) {
    return { score: 0, breakdown: { robots: 0, sitemap: 0, renderability: 0, indexability: 0 } };
  }

  // Robots — penalise blocking directives, with extra weight for AI-specific blocks
  let robotsPenalty = 0;
  for (const page of pages) {
    const directives = page.robotsDirectives.map((d) => d.toLowerCase());
    if (directives.some((d) => BLOCKING_DIRECTIVES.some((b) => d.includes(b)))) robotsPenalty += 5;
    if (directives.some((d) => AI_BLOCKING_DIRECTIVES.some((b) => d.includes(b)))) robotsPenalty += 10;
  }
  const robots = Math.max(0, 100 - Math.min(100, robotsPenalty));

  // Sitemap — based on SEO issue presence
  const missingSitemap = seo.issues.some((i) => i.type === 'missing_sitemap');
  const missingRobotsTxt = seo.issues.some((i) => i.type === 'missing_robots_txt');
  const sitemap = missingSitemap ? (missingRobotsTxt ? 20 : 50) : missingRobotsTxt ? 70 : 100;

  // Renderability — % of pages with status 200 and meaningful content
  const renderableCount = pages.filter((p) => p.statusCode === 200 && p.wordCount > 50).length;
  const renderability = Math.round((renderableCount / pages.length) * 100);

  // Indexability — % of pages without noindex directive
  const noindexCount = pages.filter((p) =>
    p.robotsDirectives.some((d) => d.toLowerCase().includes('noindex'))
  ).length;
  const indexability = Math.round(((pages.length - noindexCount) / pages.length) * 100);

  // ACI = Robots×0.30 + Sitemap×0.25 + Renderability×0.20 + Indexability×0.25
  const score = Math.round(
    robots * 0.30 + sitemap * 0.25 + renderability * 0.20 + indexability * 0.25,
  );

  return { score, breakdown: { robots, sitemap, renderability, indexability } };
}
