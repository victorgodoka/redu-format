import type { Metadata } from "next";
import Link from "next/link";
import { createTournamentAction } from "../actions";
import TournamentForm from "../tournament-form";

export const metadata: Metadata = {
  title: "New tournament | REDU Format",
  robots: { index: false, follow: false },
};

export default function NewTournamentPage() {
  return (
    <>
      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Admin</p>

          <div className="admin-bar">
            <h1 className="section__title">New tournament</h1>
            <Link className="filters__reset" href="/admin/tournaments">
              ← Back to tournaments
            </Link>
          </div>

          <TournamentForm action={createTournamentAction} />
        </div>
      </main>
    </>
  );
}
