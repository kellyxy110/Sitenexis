'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Download, Copy, CheckCircle2,
  BarChart3, ArrowRight, Sparkles, Globe,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type CheckStatus = 'strong' | 'partial' | 'weak' | 'na';

type CheckResult = {
  id: string;
  label: string;
  weight: number;
  earned: number;
  status: CheckStatus;
  found: string;
  fix: string;
  isNa: boolean;
};

type ScorerResult = {
  inputType: 'html' | 'text';
  score: number;
  checks: CheckResult[];
};

// ── Text utilities ─────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 5);
}

const FILLER_OPENS = [
  /^in today['']s/i, /^have you ever/i, /^when it comes to/i,
  /^it['']s no secret/i, /^are you (looking|wondering|trying)/i,
  /^in this (article|post|guide|blog)/i, /^welcome to/i,
  /^as (we|you) (all )?know/i, /^it is (well[- ]known|important to)/i,
];

function isFillerOpen(s: string): boolean {
  return FILLER_OPENS.some((re) => re.test(s.trim()));
}

const QUESTION_WORDS = /^(what|how|why|when|where|who|which|can|does|is|are|should|will)\b/i;

function isQuestion(h: string): boolean {
  return h.trimEnd().endsWith('?') || QUESTION_WORDS.test(h.trim());
}

// ── Extracted page data ────────────────────────────────────────────────────────

type PageData = {
  inputType: 'html' | 'text';
  title: string;
  metaDesc: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  paragraphs: string[];
  listCount: number;
  tableCount: number;
  bodyText: string;
  jsonLdTypes: string[];
  hasFaqSchema: boolean;
  hasHtmlFeatures: boolean;
};

function detectInputType(input: string): 'html' | 'text' {
  return (input.match(/<[a-z][^>]*>/gi) ?? []).length >= 3 ? 'html' : 'text';
}

function extractFromHtml(raw: string): PageData {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim() ?? '';
  const metaDesc =
    doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ??
    doc.querySelector('meta[name=description]')?.getAttribute('content')?.trim() ??
    '';
  for (const el of doc.querySelectorAll('nav,footer,aside,header,script,style')) el.remove();
  const h1s = [...doc.querySelectorAll('h1')].map((el) => el.textContent?.trim() ?? '').filter(Boolean);
  const h2s = [...doc.querySelectorAll('h2')].map((el) => el.textContent?.trim() ?? '').filter(Boolean);
  const h3s = [...doc.querySelectorAll('h3')].map((el) => el.textContent?.trim() ?? '').filter(Boolean);
  const paragraphs = [...doc.querySelectorAll('p')]
    .map((el) => el.textContent?.trim() ?? '')
    .filter((t) => t.length > 20);
  const listCount = doc.querySelectorAll('ul,ol').length;
  const tableCount = doc.querySelectorAll('table').length;
  const bodyText = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const jsonLdBlocks = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(
    (el) => el.textContent ?? '',
  );
  const jsonLdTypes = jsonLdBlocks.flatMap((block) =>
    [...block.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1] ?? ''),
  );
  const hasFaqSchema = jsonLdTypes.some((t) => t.toLowerCase() === 'faqpage');
  return {
    inputType: 'html', title, metaDesc, h1s, h2s, h3s, paragraphs,
    listCount, tableCount, bodyText, jsonLdTypes, hasFaqSchema, hasHtmlFeatures: true,
  };
}

function extractFromText(raw: string): PageData {
  const lines = raw.split('\n');
  const h1s = lines.filter((l) => /^#\s/.test(l) && !/^##/.test(l)).map((l) => l.replace(/^#+\s*/, '').trim());
  const h2s = lines.filter((l) => /^##\s/.test(l) && !/^###/.test(l)).map((l) => l.replace(/^#+\s*/, '').trim());
  const h3s = lines.filter((l) => /^###\s/.test(l) && !/^####/.test(l)).map((l) => l.replace(/^#+\s*/, '').trim());
  const paragraphs: string[] = [];
  let cur = '';
  for (const line of lines) {
    if (/^#+\s/.test(line) || /^[\-\*\+]\s|^\d+\.\s/.test(line.trim()) || line.trim() === '') {
      if (cur.trim()) { paragraphs.push(cur.trim()); cur = ''; }
    } else {
      cur += ' ' + line;
    }
  }
  if (cur.trim()) paragraphs.push(cur.trim());
  const listLines = lines.filter((l) => /^[\-\*\+]\s|^\d+\.\s/.test(l.trim()));
  const listCount = listLines.length > 3 ? Math.ceil(listLines.length / 3) : listLines.length > 0 ? 1 : 0;
  const tableCount = lines.filter((l) => /^\|.+\|/.test(l.trim())).length > 2 ? 1 : 0;
  const bodyText = raw.replace(/^#+\s/gm, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  return {
    inputType: 'text', title: '', metaDesc: '', h1s, h2s, h3s, paragraphs,
    listCount, tableCount, bodyText, jsonLdTypes: [], hasFaqSchema: false, hasHtmlFeatures: false,
  };
}

// ── The 9 checks ───────────────────────────────────────────────────────────────

function checkAnswerFirst(data: PageData): CheckResult {
  const wt = 15;
  const { paragraphs } = data;
  if (!paragraphs.length) return mk('answer_first', 'Answer-first openings', wt, 0, 'weak', 'No paragraphs found.', 'Structure content into clear paragraphs that open with the direct answer.', false);
  const sample = paragraphs.slice(0, 14);
  let good = 0;
  const fillerExamples: string[] = [];
  for (const p of sample) {
    const first = splitSentences(p)[0] ?? p;
    if (wordCount(first) <= 28 && !isFillerOpen(first)) good++;
    else if (isFillerOpen(first)) fillerExamples.push(`"${first.slice(0, 45)}…"`);
  }
  const ratio = good / sample.length;
  const earned = Math.round(ratio * wt);
  const status: CheckStatus = ratio >= 0.65 ? 'strong' : ratio >= 0.35 ? 'partial' : 'weak';
  return mk('answer_first', 'Answer-first openings', wt, earned, status,
    `${good}/${sample.length} sections open with a direct, concise sentence`,
    ratio >= 0.65
      ? 'Good answer-first structure. Keep leading each section with the key point before elaborating.'
      : `Remove filler openers like "In today's world…" or "Have you ever…". State the answer in ≤28 words before elaborating. ${fillerExamples.length ? `Found: ${fillerExamples[0]}` : ''}`, false);
}

function checkQuestionHeadings(data: PageData): CheckResult {
  const wt = 12;
  const all = [...data.h2s, ...data.h3s];
  if (!all.length) return mk('question_headings', 'Question-style headings', wt, 0, 'na',
    'No H2 or H3 headings found',
    'Add H2/H3 subheadings phrased as questions that match the queries your audience types.', true);
  const qCount = all.filter(isQuestion).length;
  const ratio = qCount / all.length;
  const earned = Math.round(ratio * wt);
  const status: CheckStatus = ratio >= 0.5 ? 'strong' : ratio >= 0.2 ? 'partial' : 'weak';
  return mk('question_headings', 'Question-style headings', wt, earned, status,
    `${qCount}/${all.length} H2/H3 headings phrased as questions`,
    ratio >= 0.5
      ? 'Good question-style headings. AI systems treat these as direct-answer signal triggers.'
      : 'Rewrite at least half your H2/H3 headings as questions (e.g. "How does X work?" or "What is Y?"). This directly matches conversational AI query patterns.', false);
}

function checkFaqBlocks(data: PageData): CheckResult {
  const wt = 12;
  if (data.hasFaqSchema) return mk('faq_blocks', 'FAQ / Q&A blocks', wt, wt, 'strong',
    'FAQPage JSON-LD schema detected',
    'FAQPage schema present. Verify question text in schema exactly matches visible on-page questions.', false);
  const questionHeadings = [...data.h2s, ...data.h3s].filter((h) => h.trimEnd().endsWith('?'));
  const hasQaPattern = questionHeadings.length >= 2;
  const hasQaText = /\bQ:\s.+/.test(data.bodyText) || (data.bodyText.match(/\?\s/g) ?? []).length >= 4;
  if (hasQaPattern || hasQaText) return mk('faq_blocks', 'FAQ / Q&A blocks', wt, 8, 'partial',
    hasQaPattern ? `${questionHeadings.length} question-headings detected (no FAQPage schema)` : 'Q&A text pattern detected — no FAQPage schema',
    'Add FAQPage JSON-LD schema to wrap Q&A content. This directly signals AI systems to extract your answers as citation candidates.', false);
  return mk('faq_blocks', 'FAQ / Q&A blocks', wt, 0, 'weak',
    'No FAQ schema or Q&A patterns detected',
    'Add a FAQ section (3–5 questions answering top user queries) and wrap with FAQPage JSON-LD schema. FAQ content is disproportionately cited by AI systems.', false);
}

function checkStructuredData(data: PageData): CheckResult {
  const wt = 12;
  if (!data.hasHtmlFeatures) return mk('structured_data', 'Structured data (JSON-LD)', wt, 0, 'na',
    'N/A — plain text input; schema detection requires HTML',
    'When publishing to HTML, add JSON-LD schema markup. At minimum: Article or WebPage. High-value: FAQPage, HowTo, Product.', true);
  if (!data.jsonLdTypes.length) return mk('structured_data', 'Structured data (JSON-LD)', wt, 0, 'weak',
    'No JSON-LD schema found',
    'Add <script type="application/ld+json"> schema. Minimum: Article or WebPage. High-value additions: FAQPage, HowTo, Product, Review.', false);
  const highValue = ['article', 'faqpage', 'howto', 'product', 'review', 'recipe', 'event', 'breadcrumb'];
  const unique = [...new Set(data.jsonLdTypes)];
  const hasHv = unique.some((t) => highValue.includes(t.toLowerCase()));
  const earned = hasHv ? wt : Math.round(wt * 0.65);
  return mk('structured_data', 'Structured data (JSON-LD)', wt, earned, hasHv ? 'strong' : 'partial',
    `Schema types: ${unique.join(', ')}`,
    hasHv
      ? 'Strong schema. Verify all required fields are populated and values match visible page content.'
      : 'Schema present but missing high-value types. Add FAQPage, Article, HowTo, or Product schema to increase citation eligibility.', false);
}

function checkScannability(data: PageData): CheckResult {
  const wt = 12;
  const total = data.listCount + data.tableCount;
  const wc = wordCount(data.bodyText);
  if (wc < 100) return mk('scannability', 'Scannable lists & tables', wt, 0, 'weak',
    'Insufficient content to evaluate', 'Add substantive content with bullet lists or tables to break up prose blocks.', false);
  const needed = wc / 400;
  const ratio = Math.min(1, total / Math.max(1, needed));
  const earned = Math.round(ratio * wt);
  const status: CheckStatus = ratio >= 0.8 ? 'strong' : ratio >= 0.4 ? 'partial' : 'weak';
  return mk('scannability', 'Scannable lists & tables', wt, earned, status,
    `${data.listCount} list${data.listCount !== 1 ? 's' : ''}, ${data.tableCount} table${data.tableCount !== 1 ? 's' : ''} — ~${wc} words`,
    ratio >= 0.8
      ? 'Good use of structured formatting. AI systems extract list items as discrete, citable facts.'
      : `Aim for ≥1 list or table per 400 words. You have ${total} for ${wc} words. Convert step-by-step prose into numbered lists; comparisons into tables.`, false);
}

function checkHeadingHierarchy(data: PageData): CheckResult {
  const wt = 10;
  const { h1s, h2s, h3s, bodyText } = data;
  const wc = wordCount(bodyText);
  const totalH = h1s.length + h2s.length + h3s.length;
  let earned = 0;
  const notes: string[] = [];
  if (h1s.length === 1) earned += 5;
  else if (h1s.length > 1) { earned += 2; notes.push(`${h1s.length} H1 tags (use exactly 1)`); }
  else notes.push('missing H1 heading');
  if (totalH > 1 && wc > 0) {
    const avg = wc / Math.max(1, totalH - 1);
    if (avg >= 150 && avg <= 400) earned += 5;
    else if (avg < 100) { earned += 2; notes.push('headings too frequent'); }
    else if (avg > 600) { earned += 2; notes.push(`headings sparse (~${Math.round(avg)} words apart)`); }
    else earned += 4;
  } else if (wc > 200 && h2s.length === 0) {
    notes.push('no H2 subheadings');
  }
  const status: CheckStatus = earned >= 8 ? 'strong' : earned >= 5 ? 'partial' : 'weak';
  return mk('heading_hierarchy', 'Heading hierarchy', wt, earned, status,
    `H1: ${h1s.length} · H2: ${h2s.length} · H3: ${h3s.length} · ${wc} words${notes.length ? ' — ' + notes.join(', ') : ''}`,
    earned >= 8
      ? 'Well-organised heading structure. AI systems use hierarchy to infer content depth and topic clustering.'
      : `Fix: ${notes.length ? notes.join('; ') + '. ' : ''}Use exactly one H1, add H2s for main sections (every 200-300 words), H3s for subsections.`, false);
}

function checkConciseness(data: PageData): CheckResult {
  const wt = 10;
  const { paragraphs, bodyText } = data;
  const wc = wordCount(bodyText);
  if (!paragraphs.length || wc < 80) return mk('conciseness', 'Concise sentences & paragraphs', wt, 0, 'weak',
    'Insufficient content', 'Add 300+ words of structured content to evaluate sentence and paragraph density.', false);
  const allSentences = paragraphs.flatMap(splitSentences);
  const avgLen = allSentences.length
    ? allSentences.reduce((s, sent) => s + wordCount(sent), 0) / allSentences.length : 0;
  const longParas = paragraphs.filter((p) => wordCount(p) > 120);
  let earned = 0;
  const notes: string[] = [];
  if (avgLen <= 18) earned += 5;
  else if (avgLen <= 25) { earned += 3; notes.push(`avg sentence ${Math.round(avgLen)} words (aim ≤18)`); }
  else { earned += 1; notes.push(`avg sentence ${Math.round(avgLen)} words — too long`); }
  if (!longParas.length) earned += 5;
  else if (longParas.length === 1) { earned += 3; notes.push('1 paragraph over 120 words'); }
  else { earned += 1; notes.push(`${longParas.length} paragraphs over 120 words`); }
  const status: CheckStatus = earned >= 8 ? 'strong' : earned >= 5 ? 'partial' : 'weak';
  return mk('conciseness', 'Concise sentences & paragraphs', wt, earned, status,
    `Avg sentence: ${Math.round(avgLen)} words · ${longParas.length} long paragraph${longParas.length !== 1 ? 's' : ''}`,
    earned >= 8
      ? 'Good sentence and paragraph density. Short, direct sentences improve AI chunk extraction quality.'
      : `Fix: ${notes.join('; ')}. Break long sentences at conjunctions. Split paragraphs >120 words at their logical division point.`, false);
}

function checkConcreteData(data: PageData): CheckResult {
  const wt = 9;
  const wc = wordCount(data.bodyText);
  if (wc < 80) return mk('concrete_data', 'Concrete data & specifics', wt, 0, 'weak',
    'Insufficient content', 'Add specific statistics, percentages, dollar amounts, or dates to signal factual density.', false);
  const matches = [
    ...(data.bodyText.match(/\b\d+(\.\d+)?%/g) ?? []),
    ...(data.bodyText.match(/\$\d[\d,.]*(\.\d+)?[kmb]?\b/gi) ?? []),
    ...(data.bodyText.match(/\b(19|20)\d{2}\b/g) ?? []),
    ...(data.bodyText.match(/\b\d{2,}(\.\d+)?[kxm]?\b/gi) ?? []).filter((m) => Number(m.replace(/[kmx]/i, '')) >= 10),
  ];
  const density = (matches.length / wc) * 100;
  const earned = density >= 3 ? wt : density >= 1.5 ? Math.round(wt * 0.65) : density >= 0.5 ? Math.round(wt * 0.33) : 0;
  const status: CheckStatus = density >= 3 ? 'strong' : density >= 1.5 ? 'partial' : 'weak';
  return mk('concrete_data', 'Concrete data & specifics', wt, earned, status,
    `~${matches.length} data points in ${wc} words (${density.toFixed(1)}/100 words)`,
    density >= 3
      ? 'Strong data density. Specific numbers, stats, and dates make content more citable than prose-only claims.'
      : `Add more specific numbers, percentages, dates, or dollar amounts. Aim for ≥3 per 100 words. Currently ${density.toFixed(1)}/100.`, false);
}

function checkTitleMeta(data: PageData): CheckResult {
  const wt = 8;
  if (!data.hasHtmlFeatures) return mk('title_meta', 'Title & meta description', wt, 0, 'na',
    'N/A — plain text input; title/meta require HTML',
    'When publishing, add <title> (50-60 chars) and <meta name="description"> (140-160 chars).', true);
  let earned = 0;
  const notes: string[] = [];
  const { title, metaDesc } = data;
  if (!title) notes.push('missing <title>');
  else if (title.length >= 30 && title.length <= 60) earned += 4;
  else { earned += 2; notes.push(`title ${title.length} chars (aim 30-60)`); }
  if (!metaDesc) notes.push('missing meta description');
  else if (metaDesc.length >= 120 && metaDesc.length <= 160) earned += 4;
  else { earned += 2; notes.push(`meta description ${metaDesc.length} chars (aim 120-160)`); }
  const titleDisplay = title ? `"${title.slice(0, 48)}${title.length > 48 ? '…' : ''}" (${title.length})` : 'missing';
  const metaDisplay = metaDesc ? `${metaDesc.length} chars` : 'missing';
  const status: CheckStatus = earned >= 7 ? 'strong' : earned >= 4 ? 'partial' : 'weak';
  return mk('title_meta', 'Title & meta description', wt, earned, status,
    `Title: ${titleDisplay} · Meta: ${metaDisplay}`,
    earned >= 7
      ? 'Title and meta description are well-configured for AI extractability and search.'
      : `Fix: ${notes.join('; ')}. Title 30-60 chars with primary keyword first. Meta 140-160 chars with clear value statement.`, false);
}

function mk(id: string, label: string, weight: number, earned: number, status: CheckStatus, found: string, fix: string, isNa: boolean): CheckResult {
  return { id, label, weight, earned, status, found, fix, isNa };
}

// ── Runner ─────────────────────────────────────────────────────────────────────

function runScorer(raw: string): ScorerResult {
  const inputType = detectInputType(raw);
  const data = inputType === 'html' ? extractFromHtml(raw) : extractFromText(raw);
  const checks = [
    checkAnswerFirst(data), checkQuestionHeadings(data), checkFaqBlocks(data),
    checkStructuredData(data), checkScannability(data), checkHeadingHierarchy(data),
    checkConciseness(data), checkConcreteData(data), checkTitleMeta(data),
  ];
  const applicable = checks.filter((c) => !c.isNa);
  const earned = applicable.reduce((s, c) => s + c.earned, 0);
  const possible = applicable.reduce((s, c) => s + c.weight, 0);
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const sorted = [...checks].sort((a, b) => {
    if (a.isNa && !b.isNa) return 1;
    if (!a.isNa && b.isNa) return -1;
    return (b.weight - b.earned) - (a.weight - a.earned);
  });
  return { inputType, score, checks: sorted };
}

// ── Grade ──────────────────────────────────────────────────────────────────────

function getGrade(score: number) {
  if (score >= 80) return { label: 'AI-Ready', verdict: 'Strong citation signal. Well-structured for AI retrieval and citation.', color: 'text-green-400', barFrom: '#22C55E', barTo: '#0BCEBC', bg: 'bg-green-500/[0.07]', border: 'border-green-500/20' };
  if (score >= 60) return { label: 'Solid', verdict: 'Citation-eligible for most queries. A few structural gaps are limiting full AI visibility.', color: 'text-teal-400', barFrom: '#0BCEBC', barTo: '#00C8FF', bg: 'bg-teal-500/[0.07]', border: 'border-teal-500/20' };
  if (score >= 40) return { label: 'Needs Work', verdict: 'Content is retrievable but rarely cited. Key structural signals are missing.', color: 'text-amber-400', barFrom: '#F59E0B', barTo: '#F97316', bg: 'bg-amber-500/[0.07]', border: 'border-amber-500/20' };
  return { label: 'Invisible', verdict: 'Below citation threshold. AI systems will retrieve but not surface this content.', color: 'text-red-400', barFrom: '#EF4444', barTo: '#DC2626', bg: 'bg-red-500/[0.07]', border: 'border-red-500/20' };
}

// ── UI sub-components ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: CheckStatus }) {
  const cls = {
    strong: 'bg-green-500/10 text-green-400 border-green-500/20',
    partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    weak:   'bg-red-500/10   text-red-400   border-red-500/20',
    na:     'bg-white/5      text-slate-500  border-white/10',
  }[status];
  const txt = status === 'na' ? 'N/A' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{txt}</span>;
}

function CheckBar({ earned, weight, status }: { earned: number; weight: number; status: CheckStatus }) {
  const pct = weight > 0 ? (earned / weight) * 100 : 0;
  const grad = {
    strong:  'from-green-500 to-teal-400',
    partial: 'from-amber-500 to-yellow-400',
    weak:    'from-red-500   to-red-400',
    na:      'from-slate-700 to-slate-600',
  }[status];
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${grad}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Sample content ─────────────────────────────────────────────────────────────

const SAMPLE = `<!DOCTYPE html>
<html>
<head>
  <title>Digital Marketing Strategies for Growing Businesses</title>
</head>
<body>
<article>
  <h1>Digital Marketing Strategies for Growing Businesses</h1>

  <p>In today's fast-paced digital landscape, businesses of all sizes are increasingly recognising the importance of having a solid digital marketing strategy that can help them reach their target audience effectively and efficiently in the modern marketplace.</p>

  <h2>The Importance of Social Media</h2>
  <p>Social media has become one of the most powerful tools available to marketers in recent years. Platforms like Facebook, Instagram, Twitter, and LinkedIn have billions of active users who spend hours each day consuming content, engaging with brands, and making purchasing decisions based on what they see in their feeds.</p>
  <p>It is important to note that not all social media platforms are created equal, and businesses should carefully consider which platforms are most appropriate for their particular target audience and marketing goals before investing significant time and resources into building a presence on those platforms.</p>

  <h2>Content Marketing Fundamentals</h2>
  <p>Content marketing involves creating and distributing valuable, relevant content to attract and engage a specific target audience. When done correctly, content marketing can help businesses establish thought leadership, build trust with their audience, and ultimately drive profitable customer action over the long term.</p>
  <ul>
    <li>Blog posts and articles</li>
    <li>Video content and tutorials</li>
    <li>Infographics and visual content</li>
    <li>Podcasts and audio content</li>
  </ul>

  <h2>Email Marketing Best Practices</h2>
  <p>Email marketing remains one of the highest ROI channels available to digital marketers. Studies have shown that for every dollar spent on email marketing, businesses can expect an average return of $42, making it an extremely cost-effective channel.</p>

  <h2>What Is Search Engine Optimisation?</h2>
  <p>SEO is the process of optimising your website and content to rank higher in search engine results pages. There are many factors that search engines consider when ranking content — including keyword relevance, content quality, page load speed, and mobile-friendliness.</p>

  <h2>Measuring Your Results</h2>
  <p>Without proper measurement and analytics, it is impossible to know whether your digital marketing efforts are actually working or not. Businesses should set up proper tracking and analytics from the very beginning of any marketing campaign to ensure they have the data they need to make informed decisions and adjustments over time as conditions change and new information becomes available to the team.</p>
</article>
</body>
</html>`;

// ── Report generator ───────────────────────────────────────────────────────────

function buildMarkdown(result: ScorerResult): string {
  const g = getGrade(result.score);
  return [
    '# AI Readiness Score Report',
    '',
    `**Score: ${result.score}/100 — ${g.label}**`,
    `> ${g.verdict}`,
    '',
    `Input type: ${result.inputType === 'html' ? 'HTML' : 'Plain text / Markdown'}`,
    '',
    '## Check Breakdown',
    '',
    '| Check | Status | Points | Finding |',
    '|-------|--------|--------|---------|',
    ...result.checks.map((c) =>
      `| ${c.label} | ${c.isNa ? 'N/A' : c.status} | ${c.isNa ? '–' : `${c.earned}/${c.weight}`} | ${c.found} |`
    ),
    '',
    '## Fix List (sorted by biggest opportunity)',
    '',
    ...result.checks
      .filter((c) => !c.isNa && c.status !== 'strong')
      .map((c) => `### ${c.label} (${c.earned}/${c.weight} pts)\n\n**Found:** ${c.found}\n\n**Fix:** ${c.fix}\n`),
    '---',
    'Generated by SiteNexis AI Readiness Scorer · sitenexis.vercel.app',
  ].join('\n');
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AiScorerPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ScorerResult | null>(null);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  function handleScore() {
    if (!input.trim()) return;
    const r = runScorer(input);
    setResult(r);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function handleCopy() {
    if (!result) return;
    void navigator.clipboard.writeText(buildMarkdown(result)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([buildMarkdown(result)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ai-readiness-report.md'; a.click();
    URL.revokeObjectURL(url);
  }

  const grade = result ? getGrade(result.score) : null;
  const applicable = result?.checks.filter((c) => !c.isNa) ?? [];
  const naCount = (result?.checks ?? []).filter((c) => c.isNa).length;

  return (
    <main className="min-h-screen bg-[#0A1628] text-slate-200">

      {/* Hero */}
      <section className="border-b border-white/[0.06] px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            <Sparkles size={11} />
            Free · Browser-only · No data leaves your device
          </span>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">
            AI Readiness Scorer
          </h1>
          <p className="mb-3 text-lg leading-relaxed text-slate-400">
            Paste any HTML or plain text. Get a 0–100 score for how likely ChatGPT, Perplexity,
            and Google AI Overviews are to cite that content — plus a prioritised fix list.
          </p>
          <p className="text-[13px] text-slate-600">
            Scores 9 citation signals. Nothing leaves your browser.
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Paste HTML or plain text / markdown
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setInput(SAMPLE); setResult(null); }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-slate-400 transition hover:border-white/[0.15] hover:text-slate-200"
              >
                Load sample
              </button>
              {input && (
                <button
                  onClick={() => { setInput(''); setResult(null); }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-slate-500 transition hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Paste your page HTML here…\n\nor plain text / markdown — auto-detected.'}
            rows={14}
            spellCheck={false}
            className="w-full resize-y rounded-2xl border border-white/[0.10] bg-white/[0.03] px-5 py-4 font-mono text-[13px] text-slate-300 placeholder-slate-700 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleScore}
              disabled={!input.trim()}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-[14px] font-semibold text-[#0A1628] transition hover:opacity-90 disabled:opacity-40"
            >
              <BarChart3 size={15} />
              Score this content
            </button>
            {result && (
              <span className="text-[12px] text-slate-600">
                {result.inputType === 'html' ? 'Detected: HTML' : 'Detected: Plain text / Markdown'}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      {result && grade && (
        <section ref={resultsRef} className="px-6 pb-20">
          <div className="mx-auto max-w-5xl">

            {/* Copy / Download */}
            <div className="mb-6 flex items-center justify-end gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-slate-400 transition hover:border-white/[0.15] hover:text-slate-200"
              >
                {copied ? <CheckCircle2 size={13} className="text-teal-400" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy report'}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-slate-400 transition hover:border-white/[0.15] hover:text-slate-200"
              >
                <Download size={13} />
                Download .md
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

              {/* Left — score card */}
              <div className="space-y-4">
                <div className={`rounded-2xl border p-6 ${grade.border} ${grade.bg}`}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    AI Readiness Score
                  </div>
                  <div className={`text-7xl font-bold tabular-nums leading-none ${grade.color}`}>
                    {result.score}
                  </div>
                  <div className={`mt-1 text-base font-semibold ${grade.color}`}>{grade.label}</div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${result.score}%`,
                        background: `linear-gradient(to right, ${grade.barFrom}, ${grade.barTo})`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-slate-500">{grade.verdict}</p>
                </div>

                {/* Meta */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 space-y-2.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Input type</span>
                    <span className="font-mono text-slate-300">
                      {result.inputType === 'html' ? 'HTML' : 'Plain text'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Checks applied</span>
                    <span className="font-mono text-slate-300">{applicable.length} / 9</span>
                  </div>
                  {naCount > 0 && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-slate-500">Skipped (N/A)</span>
                      <span className="font-mono text-slate-500">{naCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Checks passing</span>
                    <span className="font-mono text-green-400">
                      {applicable.filter((c) => c.status === 'strong').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Needs improvement</span>
                    <span className="font-mono text-amber-400">
                      {applicable.filter((c) => c.status !== 'strong').length}
                    </span>
                  </div>
                </div>

                {/* Compare with URL scanner */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    <span className="font-medium text-slate-400">Prefer URL-based scanning?</span>{' '}
                    The{' '}
                    <Link href="/tools/quick-check" className="text-cyan-500 hover:text-cyan-400 transition">
                      Citation Score tool
                    </Link>{' '}
                    crawls a live URL and measures what AI systems actually see.
                  </p>
                </div>
              </div>

              {/* Right — check breakdown */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Fix list
                    <span className="ml-2 text-slate-600">({result.checks.length} checks)</span>
                  </h2>
                  <span className="text-[11px] text-slate-600">Sorted by biggest opportunity</span>
                </div>

                <div className="space-y-3">
                  {result.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`rounded-xl border bg-white/[0.02] px-5 py-4 ${
                        check.isNa ? 'border-white/[0.04] opacity-50' : 'border-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusPill status={check.status} />
                          <span className="text-[13px] font-medium text-slate-200">{check.label}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[12px] text-slate-500">
                          {check.isNa ? '—' : `${check.earned}/${check.weight}`}
                        </span>
                      </div>

                      <CheckBar earned={check.earned} weight={check.weight} status={check.status} />

                      <p className="mt-2.5 text-[12px] text-slate-500">{check.found}</p>

                      {!check.isNa && check.status !== 'strong' && (
                        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
                          <span className="font-medium text-slate-300">Fix: </span>
                          {check.fix}
                        </p>
                      )}
                      {check.status === 'strong' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-green-500">
                          <CheckCircle2 size={12} /> {check.fix}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-teal-500/[0.04] px-8 py-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="mb-1 text-lg font-semibold text-white">Go deeper with a full site audit</h3>
                  <p className="max-w-lg text-[13px] leading-relaxed text-slate-400">
                    This scorer checks 9 signals on pasted content. A SiteNexis audit runs 16 agents across your
                    entire domain — entity intelligence, retrieval simulation, machine trust scoring,
                    recommendation surface mapping, and more.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <Link
                    href="/signup?from=ai-scorer"
                    className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-[14px] font-semibold text-[#0A1628] transition hover:opacity-90"
                  >
                    Start Full Audit <ArrowRight size={14} />
                  </Link>
                  <Link
                    href="/tools/quick-check"
                    className="flex items-center gap-1.5 text-center text-[12px] text-slate-500 transition hover:text-slate-300"
                  >
                    <Globe size={11} /> Try the live URL scanner →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* What we check (pre-result) */}
      {!result && (
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              9 weighted citation signals
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                { pts: 15, label: 'Answer-first openings',      detail: 'Direct, short openers vs. filler sentences' },
                { pts: 12, label: 'Question-style headings',    detail: 'H2/H3 phrased as user queries' },
                { pts: 12, label: 'FAQ / Q&A blocks',           detail: 'FAQPage schema or Q→A patterns' },
                { pts: 12, label: 'Structured data',            detail: 'JSON-LD types from ld+json blocks' },
                { pts: 12, label: 'Scannable lists & tables',   detail: 'Formatting density per word count' },
                { pts: 10, label: 'Heading hierarchy',          detail: 'Single H1, heading spacing' },
                { pts: 10, label: 'Concise sentences',          detail: 'Avg sentence length, paragraph size' },
                { pts: 9,  label: 'Concrete data & specifics',  detail: 'Numbers, %, $, dates per 100 words' },
                { pts: 8,  label: 'Title & meta description',   detail: 'Presence and length (HTML only)' },
              ].map(({ pts, label, detail }) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-200">{label}</span>
                    <span className="font-mono text-[11px] text-slate-600">{pts}pts</span>
                  </div>
                  <p className="text-[11px] text-slate-600">{detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-center">
              <p className="text-[12px] text-slate-500">
                N/A checks (e.g. schema on plain text) are excluded from the denominator — your score is always fair.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="border-t border-white/[0.05] px-6 py-6 text-center">
        <p className="text-[11px] text-slate-700">
          9 signals · paste HTML or text · browser-only · no account required ·{' '}
          <Link href="/tools/quick-check" className="text-slate-600 transition hover:text-slate-400">
            Try the live URL scanner →
          </Link>
        </p>
      </div>
    </main>
  );
}
