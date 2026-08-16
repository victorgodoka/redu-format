import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { getTournament } from "@/lib/tournaments";
import { createTournamentAction } from "../actions";
import TournamentForm from "../tournament-form";

export const metadata: Metadata = {
  title: "New tournament | REDU Format",
  robots: { index: false, follow: false },
};

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ copyFrom?: string }>;
}) {
  const [session, { copyFrom }] = await Promise.all([getAdminSession(), searchParams]);
  const copySource = copyFrom ? await getTournament(copyFrom) : null;

  return (
    <>
      <div className="admin-page-head">
        <h1 className="admin-heading">
          {copySource ? `Copy of ${copySource.name}` : "New tournament"}
        </h1>
        <Link className="admin-back" href="/admin/tournaments">
          ← Back to tournaments
        </Link>
      </div>

      <TournamentForm
        isEditing={false}
        action={createTournamentAction}
        defaultHost={session?.displayName ?? session?.username}
        tournament={copySource ? { ...copySource, name: `${copySource.name} (Copy)` } : undefined}
      />
    </>
  );
}
