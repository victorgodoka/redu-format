import type { Metadata } from "next";
import AdminPageHead from "@/components/admin/AdminPageHead";
import TournamentForm from "@/components/admin/TournamentForm";
import { getAdminSession } from "@/lib/auth/session";
import { getTournament } from "@/lib/tournaments";
import { createTournamentAction } from "../actions";

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
      <AdminPageHead
        title={copySource ? `Copy of ${copySource.name}` : "New tournament"}
        back={{ href: "/admin/tournaments", label: "← Back to tournaments" }}
      />

      <TournamentForm
        isEditing={false}
        action={createTournamentAction}
        defaultHost={session?.displayName ?? session?.username}
        tournament={copySource ? { ...copySource, name: `${copySource.name} (Copy)` } : undefined}
      />
    </>
  );
}
