"use client";

import { useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";

/**
 * The bracket scrolls horizontally on screen (.bracket-scroll, .bracket) so
 * it fits next to a phone-width viewport - but that same overflow:auto clips
 * whatever's currently scrolled out of view, which is exactly the part a
 * screenshot tool like html-to-image reproduces (it sizes the canvas off
 * the element's laid-out box, not its full scrollable content). Widening
 * every clipped ancestor to its scrollWidth just for the capture, then
 * restoring it, gets the whole bracket into the image regardless of screen
 * size.
 */
// scrollWidth under-reports elements whose overflow comes from a
// right-anchored absolutely-positioned child (the bracket's connector
// stubs use `right:` offsets) - pad every measurement so a rounding miss
// leaves harmless blank space instead of cropping real content.
const MEASURE_SLACK_PX = 48;

function expandScrollers(root: HTMLElement): () => void {
  const clipped = [...root.querySelectorAll<HTMLElement>("*")].filter((el) => {
    const overflowX = getComputedStyle(el).overflowX;
    return (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth;
  });
  // widening a clipped child doesn't grow a plain block parent's own box, so
  // the root needs to be widened explicitly too, to whatever's now the
  // widest content - otherwise html-to-image still sizes the canvas off the
  // root's old (narrower) width.
  const fullWidth =
    clipped.reduce((max, el) => Math.max(max, el.scrollWidth), root.clientWidth) + MEASURE_SLACK_PX;
  const restore = clipped.map((el) => ({ el, overflowX: el.style.overflowX, width: el.style.width }));
  const rootWidth = root.style.width;
  clipped.forEach((el) => {
    el.style.width = `${el.scrollWidth + MEASURE_SLACK_PX}px`;
    el.style.overflowX = "visible";
  });
  root.style.width = `${fullWidth}px`;
  return () => {
    restore.forEach(({ el, overflowX, width }) => {
      el.style.overflowX = overflowX;
      el.style.width = width;
    });
    root.style.width = rootWidth;
  };
}

/**
 * Wraps a rendered bracket with a "Download PNG" button that snapshots the
 * DOM as-is - the winner is already highlighted by the bracket's own styles,
 * so no separate render path is needed to "include" them.
 */
export default function BracketDownload({
  filename,
  champion,
  children,
}: {
  filename: string;
  /** Shown as a caption baked into the exported image only. */
  champion?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    const restore = expandScrollers(ref.current);
    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } finally {
      restore();
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button type="button" className="btn btn--quiet" onClick={download} disabled={busy}>
          {busy ? "Generating…" : "Download PNG"}
        </button>
      </div>
      <div ref={ref} style={{ padding: 16 }}>
        {champion ? (
          <p
            style={{
              margin: "0 0 16px",
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--c-accent)",
            }}
          >
            Champion — {champion}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
