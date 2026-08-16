import type { ReactNode } from "react";

/**
 * `.dash-stats`/`.dash-actions` are shared with the public player dashboard
 * (app/dashboard/page.tsx), so this wraps the existing global classes rather
 * than owning a CSS module.
 */
export default function StatBar({
  stats,
  actions,
}: {
  stats?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  return (
    <>
      {stats && stats.length > 0 ? (
        <dl className="featured__stats dash-stats panel">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className="dash-actions">{actions}</div> : null}
    </>
  );
}
