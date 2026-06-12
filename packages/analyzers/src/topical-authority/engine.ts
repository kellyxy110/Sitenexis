import type { CrawledPage } from '@sitenexis/shared';

export interface TopicalAuthorityResult {
  score: number;
  breakdown: {
    depth: number;
    breadth: number;
    interlinking: number;
    freshness: number;
  };
}

const STOP_WORDS = new Set([
  'with', 'your', 'that', 'this', 'from', 'have', 'more', 'will', 'been',
  'what', 'when', 'how', 'why', 'the', 'and', 'for', 'not', 'you', 'all',
  'can', 'her', 'was', 'one', 'our', 'out', 'are', 'which', 'their', 'there',
  'about', 'into', 'than', 'then', 'some', 'also', 'over', 'each', 'does',
  'most', 'other', 'make', 'like', 'time', 'just', 'know', 'take', 'people',
]);

export function computeTopicalAuthority(pages: CrawledPage[]): TopicalAuthorityResult {
  if (pages.length === 0) {
    return { score: 0, breakdown: { depth: 0, breadth: 0, interlinking: 0, freshness: 0 } };
  }

  // Depth — average word count × heading hierarchy depth
  const avgWordCount = pages.reduce((s, p) => s + p.wordCount, 0) / pages.length;
  const avgHeadingDepth = pages.reduce((s, p) => {
    const maxLevel = p.headings.length > 0 ? Math.max(...p.headings.map((h) => h.level)) : 1;
    return s + maxLevel;
  }, 0) / pages.length;
  const depthFromWords = Math.min(60, (avgWordCount / 1500) * 60);
  const depthFromHierarchy = Math.min(40, ((avgHeadingDepth - 1) / 2) * 40);
  const depth = Math.round(depthFromWords + depthFromHierarchy);

  // Breadth — unique significant topic terms across H1/H2 headings
  const topicSet = new Set<string>();
  for (const page of pages) {
    for (const heading of page.headings) {
      if (heading.level <= 2) {
        heading.text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
          .forEach((w) => topicSet.add(w));
      }
    }
  }
  const breadth = Math.round(Math.min(100, (topicSet.size / 20) * 100));

  // Interlinking — average internal links per page, target 5+ = full score
  const avgInternalLinks = pages.reduce((s, p) => s + p.internalLinks.length, 0) / pages.length;
  const interlinking = Math.round(Math.min(100, (avgInternalLinks / 5) * 100));

  // Freshness — % of pages with dateModified or datePublished schema
  const freshPages = pages.filter((p) => {
    const s = JSON.stringify(p.schemaMarkup).toLowerCase();
    return s.includes('datemodified') || s.includes('datepublished');
  }).length;
  const freshness = Math.round((freshPages / pages.length) * 100);

  // TA = Depth×0.4 + Breadth×0.3 + Interlinking×0.2 + Freshness×0.1
  const score = Math.round(depth * 0.4 + breadth * 0.3 + interlinking * 0.2 + freshness * 0.1);

  return { score, breakdown: { depth, breadth, interlinking, freshness } };
}
