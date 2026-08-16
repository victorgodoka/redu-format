import type { ReactNode } from "react";

export default function FactsList({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="facts panel">
      {rows.map((row, i) => (
        <div className="facts__row" key={i}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
