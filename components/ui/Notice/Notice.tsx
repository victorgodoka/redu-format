import type { ReactNode } from "react";

export default function Notice({
  variant,
  children,
  className,
}: {
  variant?: "done";
  children: ReactNode;
  className?: string;
}) {
  const variantClass = variant === "done" ? "notice--done" : "";
  return <div className={["notice", variantClass, "panel", className].filter(Boolean).join(" ")}>{children}</div>;
}
