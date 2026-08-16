import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatTime, STRUCTURES } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import DeleteButton from "../delete-button";
import { deleteTournamentAction } from "./actions";

export const metadata: Metadata = {
  title: "Manage tournaments | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminTournamentsPage() {
  const tournaments = await listTournaments();

  return (
    <>
      <div className="admin-page-head">
        <h1 className="admin-heading">Tournaments</h1>
        <Link className="btn btn--solid" href="/admin/tournaments/new">
          New tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="empty panel">
          <p className="lede">No tournaments yet. Create the first one.</p>
          <Link className="btn" href="/admin/tournaments/new">
            New tournament
          </Link>
        </div>
      ) : (
        <ul className="admin-list">
          {tournaments.map((t) => (
            <li className="admin-row panel" key={t.slug}>
              <div className="admin-row__main">
                <span className="admin-row__title">{t.name}</span>
                <span className="admin-row__meta">
                  {formatDate(t.startsAt)} · {formatTime(t.startsAt)} ·{" "}
                  {STRUCTURES[t.structure].label} · {t.taken}/
                  {t.seats === null ? "unlimited" : t.seats} seats
                </span>
              </div>
              <div className="admin-row__actions">
                <Link className="btn" href={`/admin/tournaments/${t.slug}`}>
                  Edit
                </Link>
                <Link className="btn" href={`/admin/tournaments/${t.slug}/participants`}>
                  Participants
                </Link>
                <Link className="btn" href={`/admin/tournaments/new?copyFrom=${t.slug}`}>
                  Copy
                </Link>
                <DeleteButton
                  action={deleteTournamentAction}
                  hidden={{ slug: t.slug }}
                  confirmText={`Delete ${t.name}? This cannot be undone.`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
