"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * Some card art is only hosted under the errata/alt-print id, which the
 * third-party CDNs do not always mirror. On a 404 this retries once with
 * fallbackSrc (the card's original passcode), which is far more likely to
 * exist. Give it a `key` tied to the card identity wherever the same JSX
 * position renders different cards over time (e.g. a hover preview), so the
 * retry state resets instead of sticking to a stale fallback.
 */
export default function CardImage({
  src,
  fallbackSrc,
  alt,
  ...props
}: Omit<ImageProps, "src"> & { src: string; fallbackSrc: string }) {
  const [current, setCurrent] = useState(src);

  return (
    <Image
      {...props}
      alt={alt}
      src={current}
      onError={() => {
        if (current !== fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}
