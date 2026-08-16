import type { ReactNode } from "react";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import type { TournamentEvent } from "@/lib/tournaments";

/**
 * Shared by the dashboard's "upcoming" list and the full tournaments list -
 * they differ only in which meta fields show and which actions are offered,
 * so both are passed in as render slots instead of forking the row markup.
 */
export default function TournamentList({
  tournaments,
  meta,
  actions,
}: {
  tournaments: TournamentEvent[];
  meta: (tournament: TournamentEvent) => ReactNode;
  actions: (tournament: TournamentEvent) => ReactNode;
}) {
  return (
    <AdminList>
      {tournaments.map((t) => (
        <AdminRow key={t.slug}>
          <AdminRow.Main>
            <span className="admin-row__title">{t.name}</span>
            <span className="admin-row__meta">{meta(t)}</span>
          </AdminRow.Main>
          <AdminRow.Actions>{actions(t)}</AdminRow.Actions>
        </AdminRow>
      ))}
    </AdminList>
  );
}
