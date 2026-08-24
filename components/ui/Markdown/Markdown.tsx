"use client";

import DOMPurify from "dompurify";
import showdown from "showdown";

const converter = new showdown.Converter();

/** Anything a markdown link could point at that runs code instead of navigating. */
const UNSAFE_HREF = /href="\s*(?:javascript|data|vbscript):[^"]*"/gi;

/**
 * Renders markdown to HTML.
 *
 * The source is not always admin-authored - inbox alerts quote deck names and
 * player names, which players choose themselves - so raw HTML in the source is
 * escaped rather than honoured, and only markdown's own syntax can produce
 * tags. That has to hold server-side too: React does not re-run
 * dangerouslySetInnerHTML on hydration, so the DOMPurify pass below (which is
 * a no-op without a DOM) can't be the only thing standing between a display
 * name and the page.
 */
function toHtml(source: string): string {
  const html = converter.makeHtml(source.replace(/</g, "&lt;"));
  return DOMPurify.sanitize(html.replace(UNSAFE_HREF, 'href="#"'));
}

export default function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: toHtml(source) }} />;
}
