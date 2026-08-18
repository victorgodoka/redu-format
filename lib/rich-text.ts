/**
 * A tiny markup subset for tournament descriptions: **bold**, *italic*, blank
 * lines as paragraph breaks, single newlines as line breaks. Returns data
 * (paragraphs of runs), never HTML, so callers render it with plain JSX
 * instead of dangerouslySetInnerHTML - same reasoning as parseCardText in
 * card-text.ts.
 */

export type RichTextRun = { text: string; bold: boolean; italic: boolean } | { break: true };

export function parseRichText(source: string): RichTextRun[][] {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  return normalized.split(/\n{2,}/).map(parseParagraph);
}

function parseParagraph(paragraph: string): RichTextRun[] {
  const lines = paragraph.split("\n");
  const runs: RichTextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) runs.push({ break: true });
    runs.push(...parseInline(line));
  });
  return runs;
}

const INLINE_PATTERN = /\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*/g;

function parseInline(line: string): RichTextRun[] {
  const runs: RichTextRun[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(line)) !== null) {
    if (match.index > last) {
      runs.push({ text: line.slice(last, match.index), bold: false, italic: false });
    }
    if (match[1] !== undefined) {
      runs.push({ text: match[1], bold: true, italic: false });
    } else {
      runs.push({ text: match[2], bold: false, italic: true });
    }
    last = match.index + match[0].length;
  }

  if (last < line.length) runs.push({ text: line.slice(last), bold: false, italic: false });
  return runs.filter((r) => "break" in r || r.text.length > 0);
}
