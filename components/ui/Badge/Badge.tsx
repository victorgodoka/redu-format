import type { ReactNode } from "react";

export type BadgeTone = "positive" | "neutral" | "negative" | "muted";

export default function Badge({
  tone,
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  const toneClass = tone && tone !== "muted" ? `badge--${tone}` : "";
  return <span className={["badge", toneClass, className].filter(Boolean).join(" ")}>{children}</span>;
}
