import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatTime, STRUCTURES } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import SiteHeader from "../../site-header";
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
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Admin</p>

          <div className="admin-bar">
            <h1 className="section__title">Tournaments</h1>
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
                      {STRUCTURES[t.structure].label} · {t.taken}/{t.seats} seats
                    </span>
                  </div>
                  <div className="admin-row__actions">
                    <Link className="btn" href={`/admin/tournaments/${t.slug}`}>
                      Edit
                    </Link>
                    <Link className="btn" href={`/admin/tournaments/${t.slug}/participants`}>
                      Participants
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
        </div>
      </main>
    </>
  );
}
