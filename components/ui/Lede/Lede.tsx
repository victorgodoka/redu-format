import type { ReactNode } from "react";

export default function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={["lede", className].filter(Boolean).join(" ")}>{children}</p>;
}
