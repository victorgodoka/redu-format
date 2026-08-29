import type { ReactNode } from "react";

export default function FormGroup({
  columns = 2,
  children,
}: {
  columns?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className={`form__group${columns === 3 ? " form__group--3" : ""}`}>{children}</div>
  );
}
