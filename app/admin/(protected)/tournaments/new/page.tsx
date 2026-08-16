import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { createTournamentAction } from "../actions";
import TournamentForm from "../tournament-form";

export const metadata: Metadata = {
  title: "New tournament | REDU Format",
  robots: { index: false, follow: false },
};

export default async function NewTournamentPage() {
  const session = await getAdminSession();

  return (
    <>
      <div className="admin-page-head">
        <h1 className="admin-heading">New tournament</h1>
        <Link className="admin-back" href="/admin/tournaments">
          ← Back to tournaments
        </Link>
      </div>

      <TournamentForm
        isEditing={false}
        action={createTournamentAction}
        defaultHost={session?.displayName ?? session?.username}
      />
    </>
  );
}
