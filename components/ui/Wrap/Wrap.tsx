import type { ReactNode } from "react";

export default function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["wrap", className].filter(Boolean).join(" ")}>{children}</div>;
}
