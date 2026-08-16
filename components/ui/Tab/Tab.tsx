import type { ReactNode } from "react";

export default function Tab({ children }: { children: ReactNode }) {
  return <p className="tab">{children}</p>;
}
