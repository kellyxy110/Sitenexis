/**
 * Telegram hard-limits sendMessage text to 4096 UTF-16 code units. Long
 * canonical output (/report, /fixplan, /issues on a large site) is split on
 * line boundaries — never mid-line, so an HTML tag opened and closed on the
 * same line (the only pattern every command in this codebase produces) is
 * never split across two messages.
 */
const TELEGRAM_MAX_MESSAGE_LEN = 3500;

export function chunkTelegramMessage(text: string, maxLen = TELEGRAM_MAX_MESSAGE_LEN): string[] {
  if (text.length <= maxLen) return [text];

  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (line.length > maxLen) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < line.length; i += maxLen) chunks.push(line.slice(i, i + maxLen));
      continue;
    }
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
