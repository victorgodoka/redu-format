import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { formatDate, formatTime, STRUCTURES } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import DeleteButton from "../delete-button";
import { deleteTournamentAction } from "./actions";

export const metadata: Metadata = {
  title: "Manage tournaments | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminTournamentsPage() {
  // Middleware already gates this route; re-checking here is only to read
  // the username for display, and to fail safe if that guarantee ever moves.
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");

  const tournaments = await listTournaments();

  return (
    <>
      <main className="section" id="main">
        <div className="wrap">
          <div className="admin-bar">
            <p className="tab">Admin</p>
            <div className="admin-identity">
              <span>
                Signed in as {admin.displayName} (@{admin.username})
              </span>
              <Link className="admin-identity__link" href="/admin/dashboard">
                Admin home
              </Link>
              <Link className="admin-identity__link" href="/admin/logs">
                Logs
              </Link>
              <form action="/admin/logout" method="post">
                <button className="admin-identity__link admin-identity__signout" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>

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
