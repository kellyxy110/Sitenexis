import {
  type CrawledPage,
  type ContentQualityScore,
  type ContentPageScore,
} from '@sitenexis/shared';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THIN_WORD_COUNT = 300;
const THIN_PARAGRAPH_COUNT = 3;
const THIN_SIMILARITY_THRESHOLD = 0.70;   // jaccard similarity against other pages
const STUFFING_WARNING_DENSITY = 0.03;    // 3%
const STUFFING_CRITICAL_DENSITY = 0.05;   // 5%
const STUFFING_MAX_OCCURRENCES_PER_100 = 3;
const DUPLICATE_INTENT_THRESHOLD = 0.65;  // cosine similarity of title+H1 TF-IDF

const FAQ_TRIGGER_WORDS = new Set([
  'what', 'how', 'why', 'guide', 'tips', 'best', 'top', 'learn',
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'this', 'that', 'it', 'its', 'by', 'from', 'as', 'we', 'our', 'you',
  'your', 'they', 'their', 'can', 'will', 'not', 'no', 'all', 'so', 'do',
]);

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyse content quality across all crawled pages.
 *
 * Runs 5 checks: thin content, duplicate intent, keyword stuffing,
 * FAQ opportunity detection, and semantic depth scoring.
 *
 * @param pages    - Full crawl result.
 * @param rawHtml  - Optional map of URL → raw HTML (used for paragraph/list detection).
 */
export function analyzeContentQuality(
  pages: CrawledPage[],
  rawHtml: Record<string, string> = {}
): ContentQualityScore {
  if (pages.length === 0) {
    return {
      score: 0,
      pageScores: [],
      thinPages: [],
      duplicateIntentGroups: [],
      stuffedPages: [],
      lowDepthPages: [],
      faqOpportunities: [],
    };
  }

  // ── Check 1: Thin content ──────────────────────────────────────────────────
  const thinPages = detectThinPages(pages);

  // ── Check 2: Duplicate intent ──────────────────────────────────────────────
  const duplicateIntentGroups = detectDuplicateIntent(pages);

  // ── Check 3: Keyword stuffing ──────────────────────────────────────────────
  const stuffingResults = pages.map(analyzeKeywordStuffing);
  const stuffedPages = stuffingResults
    .filter((r) => r.isStuffed)
    .map((r) => r.url);

  // ── Check 4: FAQ opportunities ─────────────────────────────────────────────
  const faqOpportunities = detectFaqOpportunities(pages);

  // ── Check 5: Semantic depth ────────────────────────────────────────────────
  const depthResults = pages.map((p) => ({
    url: p.url,
    score: computeSemanticDepth(p, rawHtml[p.url] ?? ''),
  }));
  const lowDepthPages = depthResults
    .filter((r) => r.score < 50)
    .map((r) => r.url);

  // ── Per-page content scores ────────────────────────────────────────────────
  const stuffingMap = new Map(stuffingResults.map((r) => [r.url, r]));
  const depthMap = new Map(depthResults.map((r) => [r.url, r.score]));
  const thinSet = new Set(thinPages);
  const stuffedSet = new Set(stuffedPages);

  const pageScores: ContentPageScore[] = pages.map((p) => {
    const stuffing = stuffingMap.get(p.url)!;
    const depth = depthMap.get(p.url) ?? 0;

    // Thin penalty: deduct up to 40 points
    const thinPenalty = thinSet.has(p.url)
      ? (p.wordCount < 150 ? 40 : 20)
      : 0;

    // Stuffing penalty: deduct up to 30 points
    const stuffingPenalty = stuffing.isStuffed
      ? (stuffing.maxDensity > STUFFING_CRITICAL_DENSITY ? 30 : 15)
      : 0;

    const contentScore = Math.max(0, Math.round(
      depth * 0.6 + (100 - thinPenalty - stuffingPenalty) * 0.4
    ));

    return {
      url: p.url,
      contentScore,
      semanticDepthScore: depth,
      isThin: thinSet.has(p.url),
      isStuffed: stuffedSet.has(p.url),
      topKeywords: stuffing.topKeywords,
    };
  });

  // ── Site-wide score ────────────────────────────────────────────────────────
  const avgContentScore =
    pageScores.reduce((sum, p) => sum + p.contentScore, 0) / pageScores.length;
  const duplicatePenalty = Math.min(20, duplicateIntentGroups.length * 5);
  const siteScore = Math.round(Math.max(0, Math.min(100, avgContentScore - duplicatePenalty)));

  return {
    score: siteScore,
    pageScores,
    thinPages,
    duplicateIntentGroups,
    stuffedPages,
    lowDepthPages,
    faqOpportunities,
  };
}

// ─── Check 1: Thin content ────────────────────────────────────────────────────

function detectThinPages(pages: CrawledPage[]): string[] {
  const thin: string[] = [];

  // Build a bag-of-words fingerprint for cross-page similarity
  const fingerprints = pages.map((p) => tokenSet(p.bodyText));

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const fp = fingerprints[i]!;

    // Word count check
    if (page.wordCount < THIN_WORD_COUNT) {
      thin.push(page.url);
      continue;
    }

    // Paragraph count proxy: count double-newlines or sentence-ending punctuation clusters
    const paragraphCount = countParagraphs(page.bodyText);
    if (paragraphCount < THIN_PARAGRAPH_COUNT) {
      thin.push(page.url);
      continue;
    }

    // Cross-page similarity: if bodyText is >70% similar to another page, it's thin
    let isSimilar = false;
    for (let j = 0; j < pages.length; j++) {
      if (i === j) continue;
      const otherFp = fingerprints[j]!;
      if (jaccardSimilarity(fp, otherFp) > THIN_SIMILARITY_THRESHOLD) {
        isSimilar = true;
        break;
      }
    }
    if (isSimilar) thin.push(page.url);
  }

  return [...new Set(thin)];
}

function countParagraphs(text: string): number {
  // Proxy: count groups of 2+ sentences separated by blank lines or
  // sentence-ending punctuation followed by significant whitespace
  const paras = text.split(/\n\s*\n|\r\n\s*\r\n/).filter((p) => p.trim().length > 20);
  if (paras.length >= THIN_PARAGRAPH_COUNT) return paras.length;
  // Fallback: count sentences (period/!/? followed by space + capital)
  const sentences = text.split(/[.!?]\s+[A-Z]/).length;
  return Math.ceil(sentences / 3);
}

// ─── Check 2: Duplicate intent (TF-IDF cosine similarity) ─────────────────────

function detectDuplicateIntent(pages: CrawledPage[]): string[][] {
  // Build TF-IDF vectors from title + H1 + slug
  const docs = pages.map((p) => {
    const slug = urlSlug(p.url);
    return tokenize(`${p.title ?? ''} ${p.h1 ?? ''} ${slug}`);
  });

  const idf = computeIdf(docs);
  const vectors = docs.map((doc) => computeTfIdf(doc, idf));

  const groups: string[][] = [];
  const grouped = new Set<number>();

  for (let i = 0; i < pages.length; i++) {
    if (grouped.has(i)) continue;
    const group: string[] = [pages[i]!.url];

    for (let j = i + 1; j < pages.length; j++) {
      if (grouped.has(j)) continue;
      const sim = cosineSimilarity(vectors[i]!, vectors[j]!);
      if (sim >= DUPLICATE_INTENT_THRESHOLD) {
        group.push(pages[j]!.url);
        grouped.add(j);
      }
    }

    if (group.length > 1) {
      grouped.add(i);
      groups.push(group);
    }
  }

  return groups;
}

function computeIdf(docs: string[][]): Map<string, number> {
  const docCount = docs.length;
  const df = new Map<string, number>();

  for (const doc of docs) {
    const seen = new Set(doc);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df.entries()) {
    idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
  }
  return idf;
}

function computeTfIdf(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  const tfidf = new Map<string, number>();
  for (const [term, count] of tf.entries()) {
    tfidf.set(term, (count / tokens.length) * (idf.get(term) ?? 1));
  }
  return tfidf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, aVal] of a.entries()) {
    const bVal = b.get(term) ?? 0;
    dot += aVal * bVal;
    normA += aVal * aVal;
  }
  for (const val of b.values()) normB += val * val;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Check 3: Keyword stuffing ────────────────────────────────────────────────

interface StuffingResult {
  url: string;
  isStuffed: boolean;
  maxDensity: number;
  topKeywords: Array<{ word: string; density: number }>;
}

function analyzeKeywordStuffing(page: CrawledPage): StuffingResult {
  const words = tokenize(page.bodyText);
  if (words.length === 0) {
    return { url: page.url, isStuffed: false, maxDensity: 0, topKeywords: [] };
  }

  const freq = new Map<string, number>();
  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const totalWords = words.length;
  const top5 = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({
      word,
      density: count / totalWords,
    }));

  const maxDensity = top5[0]?.density ?? 0;
  const occurrencesPer100 = maxDensity * 100;
  const isStuffed =
    occurrencesPer100 > STUFFING_MAX_OCCURRENCES_PER_100 ||
    maxDensity > STUFFING_WARNING_DENSITY;

  return { url: page.url, isStuffed, maxDensity, topKeywords: top5 };
}

// ─── Check 4: FAQ opportunities ───────────────────────────────────────────────

function detectFaqOpportunities(pages: CrawledPage[]): string[] {
  return pages
    .filter((page) => {
      const text = `${page.title ?? ''} ${page.h1 ?? ''}`.toLowerCase();
      const hasTriggerWord = [...text.split(/\s+/)].some((w) => FAQ_TRIGGER_WORDS.has(w));
      if (!hasTriggerWord) return false;

      // Check: no FAQPage schema
      const hasFaqSchema = page.schemaMarkup.some((s) => {
        if (typeof s !== 'object' || s === null) return false;
        const obj = s as Record<string, unknown>;
        return obj['@type'] === 'FAQPage';
      });
      if (hasFaqSchema) return false;

      return true;
    })
    .map((p) => p.url);
}

// ─── Check 5: Semantic depth scoring ─────────────────────────────────────────

function computeSemanticDepth(page: CrawledPage, rawHtml: string): number {
  let score = 0;

  // Word count: up to 30 points
  // 300w = 10pts, 600w = 20pts, 1000w+ = 30pts
  if (page.wordCount >= 1000) score += 30;
  else if (page.wordCount >= 600) score += 20;
  else if (page.wordCount >= 300) score += 10;
  else score += Math.round((page.wordCount / 300) * 10);

  // Heading structure (H2s, H3s): up to 20 points
  const h2Count = page.headings.filter((h) => h.level === 2).length;
  const h3Count = page.headings.filter((h) => h.level === 3).length;
  if (h2Count >= 3) score += 15;
  else if (h2Count >= 1) score += 8;
  if (h3Count >= 2) score += 5;

  // Lists/tables in raw HTML: up to 10 points
  if (rawHtml) {
    const hasLists = /<ul\b|<ol\b/i.test(rawHtml);
    const hasTables = /<table\b/i.test(rawHtml);
    if (hasLists) score += 7;
    if (hasTables) score += 3;
  }

  // External links to authoritative sources: up to 10 points
  const extLinkCount = page.externalLinks.length;
  if (extLinkCount >= 3) score += 10;
  else if (extLinkCount >= 1) score += 5;

  // Internal links: up to 10 points (3+ = full score)
  const intLinkCount = page.internalLinks.length;
  if (intLinkCount >= 3) score += 10;
  else if (intLinkCount >= 1) score += 5;

  // Image alt text completeness: up to 10 points
  if (page.images.length === 0) {
    score += 10; // no images — not penalised
  } else {
    const withAlt = page.images.filter((img) => img.alt?.trim()).length;
    score += Math.round((withAlt / page.images.length) * 10);
  }

  // Schema presence: up to 10 points
  if (page.schemaMarkup.length >= 2) score += 10;
  else if (page.schemaMarkup.length === 1) score += 6;

  return Math.min(100, score);
}

// ─── Text utilities ───────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function urlSlug(url: string): string {
  try {
    return new URL(url).pathname.replace(/\//g, ' ').replace(/-/g, ' ');
  } catch {
    return '';
  }
}
