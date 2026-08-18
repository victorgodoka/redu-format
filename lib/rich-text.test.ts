import assert from "node:assert/strict";
import test from "node:test";
import { parseRichText } from "./rich-text.ts";

test("plain text with no markup passes through as one paragraph", () => {
  assert.deepEqual(parseRichText("Bring proxies, no exceptions."), [
    [{ text: "Bring proxies, no exceptions.", bold: false, italic: false }],
  ]);
});

test("empty or whitespace-only input has no paragraphs", () => {
  assert.deepEqual(parseRichText(""), []);
  assert.deepEqual(parseRichText("   \n  "), []);
});

test("blank lines split paragraphs, single newlines become breaks", () => {
  const paragraphs = parseRichText("Line one\nLine two\n\nSecond paragraph");
  assert.deepEqual(paragraphs, [
    [
      { text: "Line one", bold: false, italic: false },
      { break: true },
      { text: "Line two", bold: false, italic: false },
    ],
    [{ text: "Second paragraph", bold: false, italic: false }],
  ]);
});

test("bold and italic markup splits into runs without losing characters", () => {
  const runs = parseRichText("Top **8** cut, *Bo3* finals.")[0];
  assert.deepEqual(runs, [
    { text: "Top ", bold: false, italic: false },
    { text: "8", bold: true, italic: false },
    { text: " cut, ", bold: false, italic: false },
    { text: "Bo3", bold: false, italic: true },
    { text: " finals.", bold: false, italic: false },
  ]);
});

test("no markup delimiters survive into rendered runs", () => {
  const joined = parseRichText("**Bold** and *italic* and plain")[0]
    .map((r) => ("break" in r ? "" : r.text))
    .join("");
  assert.equal(joined, "Bold and italic and plain");
});
