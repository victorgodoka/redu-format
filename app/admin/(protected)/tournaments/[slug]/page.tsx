import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import DeleteButton from "@/components/admin/DeleteButton";
import StatBar from "@/components/admin/StatBar";
import TournamentForm from "@/components/admin/TournamentForm";
import Button from "@/components/ui/Button";
import { getTournament } from "@/lib/tournaments";
import { cancelTournamentAction, deleteTournamentAction, updateTournamentAction } from "../actions";

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
      <AdminPageHead
        title={tournament.name}
        back={{ href: "/admin/tournaments", label: "← Back to tournaments" }}
      />

      <TournamentForm isEditing={true} action={updateTournamentAction} tournament={tournament} />

      <StatBar
        actions={
          <>
            <Button href={`/admin/tournaments/${tournament.slug}/participants`}>
              Manage participants
            </Button>
            <Button href={`/admin/tournaments/${tournament.slug}/bracket`}>Manage bracket</Button>
            {tournament.status === "scheduled" || tournament.status === "running" ? (
              <DeleteButton
                action={cancelTournamentAction}
                hidden={{ slug: tournament.slug }}
                confirmText={`Cancel ${tournament.name}? It won't generate placings or count for the ranking. This can't be undone.`}
                label="Cancel tournament"
              />
            ) : null}
            <DeleteButton
              action={deleteTournamentAction}
              hidden={{ slug: tournament.slug }}
              confirmText={`Delete ${tournament.name}? This cannot be undone.`}
            />
          </>
        }
      />
    </>
  );
}
