/**
 * Card text helpers, deliberately free of data imports.
 *
 * Client components need these, and anything this module pulls in gets bundled
 * for the browser. Importing them from lib/cards.ts would drag CARD_LIB's 1.4MB
 * along with them.
 */

export type CardJson = {
  id: number;
  name: string;
  desc: string;
  printId: number;
  errataId: number | null;
  koid: number | null;
  rulingsUrl: string;
};

export type TextRun = { text: string; bold: boolean };

/**
 * Splits card text into plain and bold runs. Returning data rather than HTML
 * keeps the markup out of dangerouslySetInnerHTML.
 */
export function parseCardText(desc: string): TextRun[] {
  const parts: TextRun[] = [];
  const pattern = /\[b\]([\s\S]*?)\[\/b\]/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(desc)) !== null) {
    if (match.index > last) {
      parts.push({ text: desc.slice(last, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }

  if (last < desc.length) parts.push({ text: desc.slice(last), bold: false });
  return parts.filter((p) => p.text.length > 0);
}
