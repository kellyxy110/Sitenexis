import { describe, it, expect } from 'vitest';
import { chunkTelegramMessage } from '../message-chunking';

describe('chunkTelegramMessage', () => {
  it('returns a single chunk when the text is under the limit', () => {
    const text = 'Hello world';
    expect(chunkTelegramMessage(text)).toEqual([text]);
  });

  it('splits long text into multiple chunks, each within the limit', () => {
    const line = 'x'.repeat(100);
    const text = Array.from({ length: 100 }, () => line).join('\n'); // ~10,100 chars
    const chunks = chunkTelegramMessage(text, 3500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(3500);
  });

  it('never splits in the middle of a line — every line stays intact within one chunk', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `<b>Line ${i}</b> ${'y'.repeat(80)}`);
    const text = lines.join('\n');
    const chunks = chunkTelegramMessage(text, 500);

    const rejoined = chunks.join('\n');
    expect(rejoined).toBe(text);
    for (const chunk of chunks) {
      for (const originalLine of lines) {
        // Every line that appears in this chunk must appear whole, not truncated.
        if (chunk.includes(originalLine.slice(0, 10))) {
          expect(chunk).toContain(originalLine);
        }
      }
    }
  });

  it('never breaks an HTML tag across two chunks (open+close always share a line)', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `<b>Section ${i}</b>: some evidence text that is reasonably long here.`);
    const chunks = chunkTelegramMessage(lines.join('\n'), 300);
    for (const chunk of chunks) {
      const opens = (chunk.match(/<b>/g) ?? []).length;
      const closes = (chunk.match(/<\/b>/g) ?? []).length;
      expect(opens).toBe(closes);
    }
  });

  it('hard-splits a single line that alone exceeds the max length', () => {
    const hugeLine = 'z'.repeat(9000);
    const chunks = chunkTelegramMessage(hugeLine, 3500);
    expect(chunks.length).toBe(3);
    expect(chunks.join('')).toBe(hugeLine);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(3500);
  });

  it('preserves total content exactly across chunk boundaries (no dropped lines)', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${i}-${'a'.repeat(50)}`);
    const chunks = chunkTelegramMessage(lines.join('\n'), 200);
    expect(chunks.join('\n')).toBe(lines.join('\n'));
  });
});
