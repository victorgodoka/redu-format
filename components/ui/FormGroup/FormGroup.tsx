import type { ReactNode } from "react";

export default function FormGroup({ children }: { children: ReactNode }) {
  return <div className="form__group">{children}</div>;
}
