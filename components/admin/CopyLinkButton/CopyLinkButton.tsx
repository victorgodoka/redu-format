"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

/** Copies the public event URL (origin + path) to the clipboard, with brief "Copied!" feedback. */
export default function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable - nothing to fall back to here.
    }
  }

  return (
    <Button type="button" variant="quiet" onClick={copy}>
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}
