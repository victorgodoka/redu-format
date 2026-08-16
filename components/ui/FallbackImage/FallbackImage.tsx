"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * Card art and avatars both come from third-party CDNs that do not mirror
 * everything (a rare errata print, a since-deleted avatar). On a load error
 * this retries once with fallbackSrc. Give it a `key` tied to the image's
 * identity wherever the same JSX position renders different sources over
 * time (e.g. a hover preview), so the retry state resets instead of sticking
 * to a stale fallback.
 */
export default function FallbackImage({
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
