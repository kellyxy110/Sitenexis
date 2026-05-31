import type { CrawledPage } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Chunk {
  id: string;
  pageUrl: string;
  text: string;
  tokenEstimate: number;
  startChar: number;
  endChar: number;
  hasDanglingReference: boolean;
  isSelfContained: boolean;
}

export interface ChunkStabilityResult {
  pageUrl: string;
  chunks: Chunk[];
  stabilityIndex: number;
  boundaryVariance: number;
  unstableChunkIds: string[];
}

// Minimum semantic unit — below this a chunk can't convey a complete thought
const MIN_CHUNK_TOKENS = 80;
// Target chunk size for most retrieval systems
const TARGET_CHUNK_TOKENS = 400;
// Maximum before truncation risk
const MAX_CHUNK_TOKENS = 600;

// Approx chars per token (English prose average)
const CHARS_PER_TOKEN = 4;

// ─── Chunking strategies ──────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Strategy A — paragraph-boundary chunking (most common in RAG systems).
 * Splits on double newlines and heading-like lines.
 */
function chunkByParagraph(pageUrl: string, text: string): Chunk[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer = '';
  let bufferStart = 0;
  let charPos = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (estimateTokens(buffer + ' ' + para) > TARGET_CHUNK_TOKENS && buffer.length > 0) {
      chunks.push(buildChunk(pageUrl, buffer.trim(), bufferStart, charPos, chunks.length, 'A'));
      buffer = para;
      bufferStart = charPos;
    } else {
      buffer = buffer ? buffer + '\n\n' + para : para;
    }
    charPos += para.length + 2;

    // Oversized single paragraph — hard split
    if (paraTokens > MAX_CHUNK_TOKENS) {
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      let sentBuf = '';
      let sentStart = bufferStart;
      for (const sent of sentences) {
        if (estimateTokens(sentBuf + sent) > TARGET_CHUNK_TOKENS && sentBuf.length > 0) {
          chunks.push(buildChunk(pageUrl, sentBuf.trim(), sentStart, sentStart + sentBuf.length, chunks.length, 'A'));
          sentStart += sentBuf.length;
          sentBuf = sent;
        } else {
          sentBuf += sent;
        }
      }
      if (sentBuf.trim()) {
        chunks.push(buildChunk(pageUrl, sentBuf.trim(), sentStart, sentStart + sentBuf.length, chunks.length, 'A'));
      }
      buffer = '';
    }
  }

  if (buffer.trim()) {
    chunks.push(buildChunk(pageUrl, buffer.trim(), bufferStart, charPos, chunks.length, 'A'));
  }

  return chunks;
}

/**
 * Strategy B — fixed-size token chunking with 20% overlap (simulates naive RAG).
 * Produces different boundaries than paragraph chunking, measuring stability.
 */
function chunkByFixedSize(pageUrl: string, text: string): Chunk[] {
  const targetChars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = Math.floor(targetChars * 0.2);
  const chunks: Chunk[] = [];
  let pos = 0;

  while (pos < text.length) {
    const end = Math.min(pos + targetChars, text.length);
    const chunkText = text.slice(pos, end).trim();
    if (chunkText.length > 0) {
      chunks.push(buildChunk(pageUrl, chunkText, pos, end, chunks.length, 'B'));
    }
    pos = end - overlapChars;
    if (pos >= text.length) break;
  }

  return chunks;
}

/**
 * Strategy C — sentence-boundary chunking (used by semantic chunkers).
 */
function chunkBySentence(pageUrl: string, text: string): Chunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
  const chunks: Chunk[] = [];
  let buffer = '';
  let bufferStart = 0;
  let charPos = 0;

  for (const sent of sentences) {
    if (estimateTokens(buffer + sent) > TARGET_CHUNK_TOKENS && buffer.length > 0) {
      chunks.push(buildChunk(pageUrl, buffer.trim(), bufferStart, charPos, chunks.length, 'C'));
      buffer = sent;
      bufferStart = charPos;
    } else {
      buffer += sent;
    }
    charPos += sent.length;
  }

  if (buffer.trim()) {
    chunks.push(buildChunk(pageUrl, buffer.trim(), bufferStart, charPos, chunks.length, 'C'));
  }

  return chunks;
}

function buildChunk(
  pageUrl: string,
  text: string,
  startChar: number,
  endChar: number,
  index: number,
  strategy: string,
): Chunk {
  const tokenEstimate = estimateTokens(text);

  // Dangling reference detection — pronouns/demonstratives at the start without context
  const hasDanglingReference = /^(it|they|this|that|these|those|he|she|we)\b/i.test(text.trimStart())
    || /\b(see above|as mentioned|as noted|the following|the above)\b/i.test(text);

  const isSelfContained = !hasDanglingReference
    && tokenEstimate >= MIN_CHUNK_TOKENS
    && tokenEstimate <= MAX_CHUNK_TOKENS;

  return {
    id: `${pageUrl}#chunk-${strategy}-${index}`,
    pageUrl,
    text,
    tokenEstimate,
    startChar,
    endChar,
    hasDanglingReference,
    isSelfContained,
  };
}

// ─── Stability measurement ─────────────────────────────────────────────────────

/**
 * Runs 3 chunking strategies and measures how stable chunk boundaries are.
 * A high stability index (→1) means the content chunks consistently regardless
 * of the retrieval system's boundary strategy.
 */
export function measureChunkStability(page: CrawledPage): ChunkStabilityResult {
  const text = page.bodyText ?? '';

  if (text.trim().length < 100) {
    return {
      pageUrl: page.url,
      chunks: [],
      stabilityIndex: 1.0,
      boundaryVariance: 0,
      unstableChunkIds: [],
    };
  }

  const chunksA = chunkByParagraph(page.url, text);
  const chunksB = chunkByFixedSize(page.url, text);
  const chunksC = chunkBySentence(page.url, text);

  // Use strategy A chunks as canonical; measure how often B and C produce the
  // same semantic unit (measured by character position overlap ≥80%).
  const stableCount = chunksA.filter((a) => {
    const bOverlap = chunksB.some((b) => overlap(a, b) >= 0.8);
    const cOverlap = chunksC.some((c) => overlap(a, c) >= 0.8);
    return bOverlap && cOverlap;
  }).length;

  const total = chunksA.length;
  const stabilityIndex = total === 0 ? 1.0 : Math.round((stableCount / total) * 100) / 100;

  const unstableChunksA = chunksA.filter((a) => {
    const bOverlap = chunksB.some((b) => overlap(a, b) >= 0.8);
    const cOverlap = chunksC.some((c) => overlap(a, c) >= 0.8);
    return !(bOverlap && cOverlap);
  });

  // Boundary variance: average absolute difference in chunk count across strategies
  const counts = [chunksA.length, chunksB.length, chunksC.length];
  const mean = counts.reduce((a, b) => a + b, 0) / 3;
  const boundaryVariance = Math.round(
    counts.reduce((sum, c) => sum + Math.abs(c - mean), 0) / 3,
  );

  return {
    pageUrl: page.url,
    chunks: chunksA,
    stabilityIndex,
    boundaryVariance,
    unstableChunkIds: unstableChunksA.map((c) => c.id),
  };
}

function overlap(a: Chunk, b: Chunk): number {
  const start = Math.max(a.startChar, b.startChar);
  const end = Math.min(a.endChar, b.endChar);
  const intersection = Math.max(0, end - start);
  const union = Math.max(a.endChar, b.endChar) - Math.min(a.startChar, b.startChar);
  return union === 0 ? 1 : intersection / union;
}
