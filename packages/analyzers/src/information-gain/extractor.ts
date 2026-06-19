import type { IGEEntity, IGEQuestion, IGEEvidenceBlock } from '@sitenexis/shared';

// ── Regex patterns ─────────────────────────────────────────────────────────────

// Proper noun / capitalized phrase: 2+ consecutive words starting with uppercase
const PROPER_NOUN_RE = /\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){1,5})\b/g;

// Tech terms: common acronyms and technical abbreviations (3–6 uppercase letters, or known patterns)
const TECH_TERM_RE = /\b([A-Z]{2,6}(?:\.[A-Z]{2,4})*|\w+(?:\.js|\.io|\.ts|\.py|\.go))\b/g;

// Question words at sentence start
const QUESTION_WORD_RE =
  /^(?:what|how|why|when|where|who|which|can|does|is|are|should|will|would|does|has|have|could|do)\b/i;

// Numeric data patterns
const NUMERIC_RE = /\d+(?:[.,]\d+)*\s*(?:%|percent|million|billion|trillion|k|M|B|x|\+)?/i;

// Statistics: number + percent or comparison language
const STATISTIC_CONTENT_RE =
  /\b\d+(?:[.,]\d+)*\s*(?:%|percent)\b|\b(?:increased?|decreased?|grew?|rose?|fell?|dropped?)\s+(?:by\s+)?\d+/i;

// Benchmark: comparison with numbers
const BENCHMARK_CONTENT_RE =
  /\b(?:faster|slower|better|worse|cheaper|more|less|higher|lower)\s+(?:than\s+)?\d+|\d+\s*(?:x|times)\s+(?:faster|slower|better)/i;

// Case study patterns
const CASE_STUDY_RE = /\b(?:case study|case studies|client|customer success|helped .{3,30} (?:increase|achieve|reduce)|we helped)\b/i;

// Experiment / test patterns
const EXPERIMENT_RE = /\b(?:a\/b test|a\/b testing|experiment(?:ed|ing|s)?|split test|we tested|our test|ran a test)\b/i;

// Dataset patterns
const DATASET_RE = /\b(?:dataset|data set|database|survey(?:ed|s)?|we (?:surveyed|analyzed|analysed|collected)|our (?:research|study|analysis))\b/i;

// Framework patterns
const FRAMEWORK_RE = /\b(?:framework|methodology|approach|model|process|system|strategy|method)\b/i;

// Attribution patterns (cited source)
const ATTRIBUTION_RE = /\b(?:according to|source:|via |cited by|reference:|from |study by|research by|published by)\b/i;

// ── Entity Extraction ──────────────────────────────────────────────────────────

/**
 * Extracts named entities from plain text.
 * Deterministic, no AI — uses regex + pattern matching.
 */
export function extractEntities(text: string): IGEEntity[] {
  const counts = new Map<string, { type: string; count: number }>();

  // Proper nouns (multi-word)
  const properMatches = text.matchAll(PROPER_NOUN_RE);
  for (const match of properMatches) {
    const name = match[1]?.trim();
    if (!name || name.length < 3) continue;
    // Skip common stopword capitalized at sentence start
    if (isStopPhrase(name)) continue;
    const key = name.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { type: 'ProperNoun', count: 1 });
    }
  }

  // Tech terms
  const techMatches = text.matchAll(TECH_TERM_RE);
  for (const match of techMatches) {
    const name = match[1]?.trim();
    if (!name || name.length < 2) continue;
    const key = name.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { type: 'TechTerm', count: 1 });
    }
  }

  // Convert to IGEEntity array — only entities mentioned 2+ times or tech terms
  const entities: IGEEntity[] = [];
  for (const [key, { type, count }] of counts.entries()) {
    if (count < 1) continue;
    // Canonical name: find first occurrence with original casing
    const canonicalMatch =
      type === 'TechTerm'
        ? text.match(new RegExp(`\\b${escapeRegex(key)}\\b`, 'i'))
        : text.match(new RegExp(`\\b${escapeRegex(key)}\\b`, 'i'));
    const canonicalName = canonicalMatch ? canonicalMatch[0] : key;
    entities.push({ name: canonicalName, type, mentionCount: count });
  }

  // Sort by mention count descending, take top 30 to keep output manageable
  return entities.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 30);
}

// ── Question Extraction ────────────────────────────────────────────────────────

/**
 * Extracts questions from HTML and plain text.
 * Sources: h2/h3 headings ending in "?", FAQ schema, interrogative sentences.
 */
export function extractQuestions(html: string, text: string): IGEQuestion[] {
  const questions: IGEQuestion[] = [];
  const seen = new Set<string>();

  function addQuestion(q: string, sourceType: IGEQuestion['sourceType'], answeredInPage: boolean): void {
    const normalized = normalizeQuestion(q);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    questions.push({ text: normalized, sourceType, answeredInPage });
  }

  // 1. H2/H3 headings ending in "?"
  const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  for (const match of html.matchAll(headingRe)) {
    const raw = stripTags(match[1] ?? '').trim();
    if (raw.endsWith('?')) {
      addQuestion(raw, 'heading', false);
    }
  }

  // 2. FAQ schema — @type: Question with name property
  const faqNameRe = /"@type"\s*:\s*"Question"[\s\S]{0,300}?"name"\s*:\s*"([^"]+)"/g;
  for (const match of html.matchAll(faqNameRe)) {
    const q = match[1]?.trim();
    if (q) addQuestion(q.endsWith('?') ? q : `${q}?`, 'faq_schema', true);
  }

  // 3. Interrogative sentences from plain text
  const sentences = text.split(/[.!]\s+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 10 || trimmed.length > 200) continue;
    if (QUESTION_WORD_RE.test(trimmed)) {
      const q = trimmed.endsWith('?') ? trimmed : `${trimmed}?`;
      addQuestion(q, 'interrogative', false);
    }
  }

  return questions.slice(0, 50); // Cap at 50 questions per page
}

// ── Evidence Block Extraction ──────────────────────────────────────────────────

/**
 * Extracts evidence blocks from plain text.
 * Deterministic pattern matching — no AI.
 */
export function extractEvidenceBlocks(text: string): IGEEvidenceBlock[] {
  const blocks: IGEEvidenceBlock[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 15 || trimmed.length > 500) continue;

    const hasNumericData = NUMERIC_RE.test(trimmed);
    const isAttributed = ATTRIBUTION_RE.test(trimmed);

    let type: IGEEvidenceBlock['type'] | null = null;

    if (STATISTIC_CONTENT_RE.test(trimmed)) {
      type = 'statistic';
    } else if (BENCHMARK_CONTENT_RE.test(trimmed)) {
      type = 'benchmark';
    } else if (CASE_STUDY_RE.test(trimmed)) {
      type = 'case_study';
    } else if (EXPERIMENT_RE.test(trimmed)) {
      type = 'experiment';
    } else if (DATASET_RE.test(trimmed)) {
      type = 'dataset';
    } else if (FRAMEWORK_RE.test(trimmed) && trimmed.length > 50) {
      type = 'framework';
    } else if (hasNumericData && trimmed.length > 40) {
      type = 'example';
    }

    if (type) {
      blocks.push({
        type,
        content: trimmed.slice(0, 200),
        hasNumericData,
        isAttributed,
      });
    }

    if (blocks.length >= 20) break; // Cap per-page evidence blocks
  }

  return blocks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function normalizeQuestion(q: string): string {
  const cleaned = q.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 5 || cleaned.length > 200) return '';
  return cleaned.endsWith('?') ? cleaned : `${cleaned}?`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOP_PHRASES = new Set([
  'The The', 'A A', 'An An', 'In In', 'On On', 'At At', 'For For',
  'This This', 'That That', 'These These', 'Those Those',
]);

function isStopPhrase(phrase: string): boolean {
  if (STOP_PHRASES.has(phrase)) return true;
  // Very short two-word phrase where both words are common
  const words = phrase.split(/\s+/);
  if (words.length === 2) {
    const common = ['The', 'A', 'An', 'In', 'On', 'At', 'For', 'To', 'Of', 'By'];
    if (common.includes(words[0] ?? '') && common.includes(words[1] ?? '')) return true;
  }
  return false;
}

/**
 * Extract plain text from HTML for use in question and evidence extraction.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract h1-h3 headings as plain text strings from HTML.
 */
export function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  for (const match of html.matchAll(re)) {
    const text = stripTags(match[1] ?? '').trim();
    if (text) headings.push(text);
  }
  return headings;
}
