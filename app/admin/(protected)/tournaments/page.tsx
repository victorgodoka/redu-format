import type { Metadata } from "next";
import AdminPageHead from "@/components/admin/AdminPageHead";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import DeleteButton from "@/components/admin/DeleteButton";
import TournamentList from "@/components/admin/TournamentList";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime, STRUCTURES, type TournamentStatus } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import { deleteTournamentAction } from "./actions";

const STATUS_LABEL: Record<TournamentStatus, string> = {
  scheduled: "Scheduled",
  running: "Running",
  finished: "Finished",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<TournamentStatus, "neutral" | "positive" | "negative"> = {
  scheduled: "neutral",
  running: "positive",
  finished: "neutral",
  cancelled: "negative",
};

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
              <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>{" "}
              {formatDate(t.startsAt)} · {formatTime(t.startsAt)} · {STRUCTURES[t.structure].label} ·{" "}
              {t.taken}/{t.seats === null ? "unlimited" : t.seats} seats
            </>
          )}
          actions={(t) => (
            <>
              <Button href={`/admin/tournaments/${t.slug}`}>Edit</Button>
              <Button href={`/admin/tournaments/${t.slug}/participants`}>Participants</Button>
              <Button href={`/admin/tournaments/new?copyFrom=${t.slug}`}>Duplicate</Button>
              <CopyLinkButton path={`/events/${t.slug}`} />
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
