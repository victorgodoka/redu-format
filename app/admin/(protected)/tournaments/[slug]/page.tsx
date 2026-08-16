import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament } from "@/lib/tournaments";
import DeleteButton from "../../delete-button";
import { deleteTournamentAction, updateTournamentAction } from "../actions";
import TournamentForm from "../tournament-form";

export const metadata: Metadata = {
  title: "Edit tournament | REDU Format",
  robots: { index: false, follow: false },
};

export default async function EditTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  return (
    <>
      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Admin</p>

          <div className="admin-bar">
            <h1 className="section__title">{tournament.name}</h1>
            <Link className="filters__reset" href="/admin/tournaments">
              ← Back to tournaments
            </Link>
          </div>

          <TournamentForm action={updateTournamentAction} tournament={tournament} />

          <div className="admin-bar">
            <Link className="btn" href={`/admin/tournaments/${tournament.slug}/participants`}>
              Manage participants
            </Link>
            <Link className="btn" href={`/admin/tournaments/${tournament.slug}/bracket`}>
              Manage bracket
            </Link>
            <DeleteButton
              action={deleteTournamentAction}
              hidden={{ slug: tournament.slug }}
              confirmText={`Delete ${tournament.name}? This cannot be undone.`}
            />
          </div>
        </div>
      </main>
    </>
  );
}
