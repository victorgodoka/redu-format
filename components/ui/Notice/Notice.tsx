import type { ReactNode } from "react";

export default function Notice({
  variant,
  children,
  className,
}: {
  variant?: "done" | "warn" | "error";
  children: ReactNode;
  className?: string;
}) {
  const variantClass = variant ? `notice--${variant}` : "";
  return <div className={["notice", variantClass, "panel", className].filter(Boolean).join(" ")}>{children}</div>;
}
