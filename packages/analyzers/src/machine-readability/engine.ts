import type { CrawledPage, MachineReadabilityScore, MachineReadabilityIssue, ExtractionStage } from '@sitenexis/shared';

// Generic anchor text patterns — text that provides zero signal to AI systems
const GENERIC_ANCHORS = new Set([
  'click here', 'read more', 'learn more', 'here', 'this', 'link',
  'more', 'more info', 'details', 'view', 'see more', 'visit', 'go',
]);

// Boilerplate element patterns (nav, footer, sidebar, cookie banners, etc.)
const BOILERPLATE_PATTERNS = [
  /^(home|about|contact|blog|services|portfolio|privacy|terms|faq|sitemap)$/i,
  /^(copyright|all rights reserved|\d{4})/i,
  /^(cookie|gdpr|accept|decline|subscribe|newsletter)/i,
  /^(menu|navigation|skip to|search|login|sign up|sign in|register)/i,
];

interface PageReadabilityResult {
  url: string;
  score: number;
  stages: Record<ExtractionStage, number>;
  issues: MachineReadabilityIssue[];
}

// ─── Stage scorers ────────────────────────────────────────────────────────────

function scoreRenderingFidelity(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  // If page returned a 2xx but body text is empty or very short, JS content may not have rendered
  if (page.statusCode >= 200 && page.statusCode < 300) {
    if (page.bodyText.length < 50) {
      score -= 60;
      issues.push({
        stage: 'rendering_fidelity',
        severity: 'critical',
        pageUrl: page.url,
        description: 'Page body text is nearly empty — content may not have rendered.',
        recommendation: 'Ensure server-side rendering or pre-rendering is used for meaningful content. AI crawlers may not execute JavaScript.',
      });
    } else if (page.bodyText.length < 200) {
      score -= 30;
      issues.push({
        stage: 'rendering_fidelity',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Page body text is unusually short, suggesting incomplete rendering.',
        recommendation: 'Audit JavaScript rendering pipeline. Consider using SSR or static generation for key pages.',
      });
    }
  }

  if (page.wordCount > 0 && page.bodyText.length / page.wordCount < 3) {
    score -= 10;
    issues.push({
      stage: 'rendering_fidelity',
      severity: 'info',
      pageUrl: page.url,
      description: 'Very low average word length suggests garbled or partial content extraction.',
      recommendation: 'Review content encoding and ensure clean HTML-to-text extraction.',
    });
  }

  return { score: Math.max(0, score), issues };
}

function scoreBoilerplateRatio(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  const lines = page.bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { score: 50, issues };

  const boilerplateLines = lines.filter((line) =>
    BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line))
  );

  const ratio = boilerplateLines.length / lines.length;

  if (ratio > 0.4) {
    score -= 40;
    issues.push({
      stage: 'boilerplate_ratio',
      severity: 'critical',
      pageUrl: page.url,
      description: `${Math.round(ratio * 100)}% of extracted text is boilerplate (nav, footer, banners).`,
      recommendation: 'Use semantic HTML landmarks (<main>, <article>) so AI crawlers can isolate primary content from navigation and chrome.',
    });
  } else if (ratio > 0.25) {
    score -= 20;
    issues.push({
      stage: 'boilerplate_ratio',
      severity: 'warning',
      pageUrl: page.url,
      description: `${Math.round(ratio * 100)}% of text content is navigation or chrome.`,
      recommendation: 'Wrap primary content in <main> or <article> and reduce boilerplate text near content blocks.',
    });
  } else if (ratio > 0.15) {
    score -= 8;
    issues.push({
      stage: 'boilerplate_ratio',
      severity: 'info',
      pageUrl: page.url,
      description: `Moderate boilerplate ratio (${Math.round(ratio * 100)}%).`,
      recommendation: 'Consider consolidating navigation and footer text to improve AI extraction signal-to-noise.',
    });
  }

  return { score: Math.max(0, score), issues };
}

function scoreChunkBoundaryQuality(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  const paragraphs = page.bodyText.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return { score: 40, issues };

  // Check for very long paragraphs that will be split mid-thought by tokenizers
  const longParagraphs = paragraphs.filter((p) => p.length > 1200);
  const longRatio = longParagraphs.length / paragraphs.length;

  if (longRatio > 0.3) {
    score -= 30;
    issues.push({
      stage: 'chunk_boundary_quality',
      severity: 'critical',
      pageUrl: page.url,
      description: `${Math.round(longRatio * 100)}% of paragraphs exceed 1200 characters and will be split by AI tokenizers.`,
      recommendation: 'Break long paragraphs into focused semantic units of 200–400 words. Each paragraph should contain one complete idea.',
    });
  } else if (longRatio > 0.15) {
    score -= 15;
    issues.push({
      stage: 'chunk_boundary_quality',
      severity: 'warning',
      pageUrl: page.url,
      description: 'Some paragraphs are too long for clean AI chunk extraction.',
      recommendation: 'Aim for paragraphs under 300 words. Use headings to introduce each new semantic section.',
    });
  }

  // Check for very short paragraphs (fragmented content)
  const veryShortParagraphs = paragraphs.filter((p) => p.trim().length < 30);
  if (veryShortParagraphs.length > paragraphs.length * 0.4) {
    score -= 15;
    issues.push({
      stage: 'chunk_boundary_quality',
      severity: 'warning',
      pageUrl: page.url,
      description: 'High proportion of very short text fragments — content appears fragmented.',
      recommendation: 'Consolidate related short sentences into coherent paragraphs. Fragmented text produces low-quality AI chunks.',
    });
  }

  return { score: Math.max(0, score), issues };
}

function scoreSignalToNoiseRatio(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  const words = page.bodyText.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 50) {
    return {
      score: 30,
      issues: [{
        stage: 'signal_to_noise_ratio',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Fewer than 50 words detected — insufficient content for AI extraction.',
        recommendation: 'Add substantive content. AI systems require at least 150–200 words to form a reliable semantic understanding of a page.',
      }],
    };
  }

  // Filler word density
  const fillerWords = new Set([
    'very', 'really', 'quite', 'just', 'simply', 'basically', 'actually',
    'literally', 'honestly', 'truly', 'absolutely', 'definitely', 'certainly',
    'obviously', 'clearly', 'of course', 'needless to say',
  ]);
  const fillerCount = words.filter((w) => fillerWords.has(w)).length;
  const fillerRatio = fillerCount / words.length;

  if (fillerRatio > 0.08) {
    score -= 25;
    issues.push({
      stage: 'signal_to_noise_ratio',
      severity: 'warning',
      pageUrl: page.url,
      description: `High filler word density (${Math.round(fillerRatio * 100)}%) reduces AI extraction quality.`,
      recommendation: 'Replace vague filler language with specific, factual statements. AI systems weight specificity and precision.',
    });
  } else if (fillerRatio > 0.05) {
    score -= 10;
    issues.push({
      stage: 'signal_to_noise_ratio',
      severity: 'info',
      pageUrl: page.url,
      description: 'Moderate filler word usage may dilute semantic signal.',
      recommendation: 'Review content for vague language and replace with precise, verifiable claims.',
    });
  }

  // Repetition check (simple: check for repeated 5-grams)
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= words.length - 5; i++) {
    const gram = words.slice(i, i + 5).join(' ');
    ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
  }
  const repeatedGrams = [...ngrams.values()].filter((count) => count > 2).length;
  if (repeatedGrams > 3) {
    score -= 15;
    issues.push({
      stage: 'signal_to_noise_ratio',
      severity: 'warning',
      pageUrl: page.url,
      description: 'Repeated phrase patterns detected — possible keyword stuffing or templated content.',
      recommendation: 'Eliminate repetitive phrasing. Each semantic unit should contain unique information.',
    });
  }

  return { score: Math.max(0, score), issues };
}

function scoreHeadingHierarchy(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  const headings = page.headings;

  if (headings.length === 0) {
    score -= 40;
    issues.push({
      stage: 'heading_hierarchy',
      severity: 'critical',
      pageUrl: page.url,
      description: 'No heading structure detected.',
      recommendation: 'Add H1–H3 headings to create a navigable semantic hierarchy. AI systems use heading structure to identify topic sections.',
    });
    return { score, issues };
  }

  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count === 0) {
    score -= 25;
    issues.push({
      stage: 'heading_hierarchy',
      severity: 'critical',
      pageUrl: page.url,
      description: 'No H1 heading found.',
      recommendation: 'Add a single H1 that clearly states the primary topic of the page. This is the primary AI topic signal.',
    });
  } else if (h1Count > 1) {
    score -= 15;
    issues.push({
      stage: 'heading_hierarchy',
      severity: 'warning',
      pageUrl: page.url,
      description: `Multiple H1 headings (${h1Count}) confuse topic identity.`,
      recommendation: 'Use exactly one H1 per page. Use H2–H3 for section structure.',
    });
  }

  // Check for heading level skips (H1 → H3 without H2)
  for (let i = 0; i < headings.length - 1; i++) {
    const current = headings[i];
    const next = headings[i + 1];
    if (current && next && next.level > current.level + 1) {
      score -= 10;
      issues.push({
        stage: 'heading_hierarchy',
        severity: 'warning',
        pageUrl: page.url,
        description: `Heading level skips from H${current.level} to H${next.level}.`,
        recommendation: 'Maintain sequential heading levels (H1 → H2 → H3). Skipping levels disrupts AI topic hierarchy parsing.',
      });
      break; // Report once per page
    }
  }

  return { score: Math.max(0, score), issues };
}

function scoreReadingOrderConsistency(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  // Reading order consistency is inferred from heading-to-content flow
  // We check that headings appear interleaved with content (not all headings first or all at end)
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  const headings = page.headings;
  const totalWords = page.wordCount;

  if (headings.length > 0 && totalWords > 200) {
    // If there are headings but minimal content words between them, content may be disorganised
    const avgWordsPerSection = totalWords / (headings.length + 1);
    if (avgWordsPerSection < 30) {
      score -= 20;
      issues.push({
        stage: 'reading_order_consistency',
        severity: 'warning',
        pageUrl: page.url,
        description: 'Very low content density between headings — sections may lack substantive content.',
        recommendation: 'Ensure each heading section contains at least 50–100 words of substantive content. AI systems skip sections with minimal body text.',
      });
    }
  }

  // If page has almost no headings but lots of text, reading order is unclear
  if (totalWords > 500 && headings.length < 2) {
    score -= 15;
    issues.push({
      stage: 'reading_order_consistency',
      severity: 'warning',
      pageUrl: page.url,
      description: 'Long content page with few or no section headings.',
      recommendation: 'Add H2/H3 headings every 200–300 words to create scannable section boundaries for AI extraction.',
    });
  }

  return { score: Math.max(0, score), issues };
}

function scoreLinkAnchorQuality(page: CrawledPage): { score: number; issues: MachineReadabilityIssue[] } {
  const issues: MachineReadabilityIssue[] = [];
  let score = 100;

  const allLinks = [...page.internalLinks, ...page.externalLinks];
  if (allLinks.length === 0) return { score, issues };

  // We infer anchor text from the page's body text by checking if generic phrases appear
  const bodyLower = page.bodyText.toLowerCase();
  let genericCount = 0;
  for (const anchor of GENERIC_ANCHORS) {
    const pattern = new RegExp(`\\b${anchor}\\b`, 'g');
    const matches = bodyLower.match(pattern);
    if (matches) genericCount += matches.length;
  }

  const genericRatio = genericCount / allLinks.length;

  if (genericRatio > 0.5) {
    score -= 30;
    issues.push({
      stage: 'link_anchor_quality',
      severity: 'critical',
      pageUrl: page.url,
      description: `High proportion of generic anchor text patterns (${genericCount} instances).`,
      recommendation: 'Replace generic anchors ("click here", "read more") with descriptive text that signals the destination topic. AI systems use anchor text as a semantic signal.',
    });
  } else if (genericRatio > 0.25) {
    score -= 15;
    issues.push({
      stage: 'link_anchor_quality',
      severity: 'warning',
      pageUrl: page.url,
      description: 'Several generic anchor text patterns detected.',
      recommendation: 'Use descriptive anchor text that describes the linked page topic. This improves entity relationship clarity for AI systems.',
    });
  }

  return { score: Math.max(0, score), issues };
}

// ─── Page-level aggregation ───────────────────────────────────────────────────

function analyzePageReadability(page: CrawledPage): PageReadabilityResult {
  const rendering = scoreRenderingFidelity(page);
  const boilerplate = scoreBoilerplateRatio(page);
  const chunkBoundary = scoreChunkBoundaryQuality(page);
  const snr = scoreSignalToNoiseRatio(page);
  const headings = scoreHeadingHierarchy(page);
  const readingOrder = scoreReadingOrderConsistency(page);
  const anchors = scoreLinkAnchorQuality(page);

  const stages: Record<ExtractionStage, number> = {
    rendering_fidelity: rendering.score,
    boilerplate_ratio: boilerplate.score,
    chunk_boundary_quality: chunkBoundary.score,
    signal_to_noise_ratio: snr.score,
    heading_hierarchy: headings.score,
    reading_order_consistency: readingOrder.score,
    link_anchor_quality: anchors.score,
  };

  // Weighted composite: rendering and SNR are highest weight
  const weightedScore = Math.round(
    stages.rendering_fidelity * 0.20
    + stages.boilerplate_ratio * 0.15
    + stages.chunk_boundary_quality * 0.20
    + stages.signal_to_noise_ratio * 0.15
    + stages.heading_hierarchy * 0.15
    + stages.reading_order_consistency * 0.10
    + stages.link_anchor_quality * 0.05
  );

  const allIssues: MachineReadabilityIssue[] = [
    ...rendering.issues,
    ...boilerplate.issues,
    ...chunkBoundary.issues,
    ...snr.issues,
    ...headings.issues,
    ...readingOrder.issues,
    ...anchors.issues,
  ];

  return { url: page.url, score: weightedScore, stages, issues: allIssues };
}

// ─── Site-level aggregation ───────────────────────────────────────────────────

export function analyzeMachineReadability(pages: CrawledPage[]): MachineReadabilityScore {
  if (pages.length === 0) {
    return {
      score: 0,
      breakdown: {
        renderingFidelity: 0,
        boilerplateRatio: 0,
        chunkBoundaryQuality: 0,
        signalToNoiseRatio: 0,
        headingHierarchy: 0,
        readingOrderConsistency: 0,
        linkAnchorQuality: 0,
      },
      issues: [],
      pageScores: [],
    };
  }

  const pageResults = pages.map(analyzePageReadability);
  const allIssues: MachineReadabilityIssue[] = pageResults.flatMap((r) => r.issues);

  const avg = (key: ExtractionStage): number =>
    Math.round(pageResults.reduce((sum, r) => sum + r.stages[key], 0) / pageResults.length);

  const breakdown = {
    renderingFidelity: avg('rendering_fidelity'),
    boilerplateRatio: avg('boilerplate_ratio'),
    chunkBoundaryQuality: avg('chunk_boundary_quality'),
    signalToNoiseRatio: avg('signal_to_noise_ratio'),
    headingHierarchy: avg('heading_hierarchy'),
    readingOrderConsistency: avg('reading_order_consistency'),
    linkAnchorQuality: avg('link_anchor_quality'),
  };

  const score = Math.round(
    breakdown.renderingFidelity * 0.20
    + breakdown.boilerplateRatio * 0.15
    + breakdown.chunkBoundaryQuality * 0.20
    + breakdown.signalToNoiseRatio * 0.15
    + breakdown.headingHierarchy * 0.15
    + breakdown.readingOrderConsistency * 0.10
    + breakdown.linkAnchorQuality * 0.05
  );

  return {
    score,
    breakdown,
    issues: allIssues,
    pageScores: pageResults.map((r) => ({ url: r.url, score: r.score })),
  };
}
