// Semantic extraction: chunks, entities, relationships
// Called by crawler.ts after HTML parsing — output fed to Layer 2+ agents

export interface PageChunk {
  index: number;
  text: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

const TARGET_CHUNK_TOKENS = 450;
const WORDS_PER_TOKEN = 0.75;
const TARGET_CHUNK_WORDS = Math.round(TARGET_CHUNK_TOKENS / WORDS_PER_TOKEN);

export function extractChunks(bodyText: string): PageChunk[] {
  const paragraphs = bodyText
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: PageChunk[] = [];
  let current = '';
  let currentWords = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).length;

    if (currentWords + words > TARGET_CHUNK_WORDS && current.length > 0) {
      chunks.push(buildChunk(chunkIndex++, current.trim(), bodyText));
      current = '';
      currentWords = 0;
    }

    current += (current ? '\n\n' : '') + paragraph;
    currentWords += words;
  }

  if (current.trim().length > 0) {
    chunks.push(buildChunk(chunkIndex, current.trim(), bodyText));
  }

  return chunks;
}

function buildChunk(index: number, text: string, fullText: string): PageChunk {
  const startOffset = fullText.indexOf(text);
  const tokenCount = Math.round(text.split(/\s+/).length * WORDS_PER_TOKEN);
  return {
    index,
    text,
    tokenCount,
    startOffset,
    endOffset: startOffset + text.length,
  };
}
