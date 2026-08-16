import type { Metadata } from "next";
import AdminPageHead from "@/components/admin/AdminPageHead";
import DeleteButton from "@/components/admin/DeleteButton";
import TournamentList from "@/components/admin/TournamentList";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime, STRUCTURES } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import { deleteTournamentAction } from "./actions";

export const metadata: Metadata = {
  title: "Manage tournaments | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminTournamentsPage() {
  const tournaments = await listTournaments();

  return (
    <>
      <AdminPageHead
        title="Tournaments"
        action={
          <Button variant="solid" href="/admin/tournaments/new">
            New tournament
          </Button>
        }
      />

      {tournaments.length === 0 ? (
        <EmptyState
          message="No tournaments yet. Create the first one."
          action={<Button href="/admin/tournaments/new">New tournament</Button>}
        />
      ) : (
        <TournamentList
          tournaments={tournaments}
          meta={(t) => (
            <>
              {formatDate(t.startsAt)} · {formatTime(t.startsAt)} · {STRUCTURES[t.structure].label} ·{" "}
              {t.taken}/{t.seats === null ? "unlimited" : t.seats} seats
            </>
          )}
          actions={(t) => (
            <>
              <Button href={`/admin/tournaments/${t.slug}`}>Edit</Button>
              <Button href={`/admin/tournaments/${t.slug}/participants`}>Participants</Button>
              <Button href={`/admin/tournaments/new?copyFrom=${t.slug}`}>Copy</Button>
              <DeleteButton
                action={deleteTournamentAction}
                hidden={{ slug: t.slug }}
                confirmText={`Delete ${t.name}? This cannot be undone.`}
              />
            </>
          )}
        />
      )}
    </>
  );
}
