import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import CancelTournamentButton from "@/components/admin/CancelTournamentButton";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import DeleteTournamentButton from "@/components/admin/DeleteTournamentButton";
import PrizingPanel from "@/components/admin/PrizingPanel";
import StatBar from "@/components/admin/StatBar";
import TournamentForm from "@/components/admin/TournamentForm";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import { listPrizes } from "@/lib/backend/services/prizing.service";
import { STRUCTURES, type TournamentStatus } from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
import { updateTournamentAction } from "../actions";

const STATUS_LABEL: Record<TournamentStatus, string> = {
  scheduled: "Scheduled",
  running: "Running",
  finished: "Finished",
  cancelled: "Cancelled",
};

export const metadata: Metadata = {
  title: "Edit tournament | REDU Format",
  robots: { index: false, follow: false },
};

export default async function EditTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; sent?: string; unclaimed?: string }>;
}) {
  const { slug } = await params;
  const { error, sent, unclaimed } = await searchParams;

  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const prizes = tournament.hasPrizing ? await listPrizes(slug) : [];

  const structureLabel =
    STRUCTURES[tournament.structure].label +
    (tournament.structure === "swiss" && tournament.topCut ? " + Top Cut" : "");
  const eyebrow = `${STATUS_LABEL[tournament.status]} · ${structureLabel} · ${
    tournament.taken
  } ${tournament.taken === 1 ? "player" : "players"}`;

  return (
    <>
      <AdminPageHead
        title={
          <span className="admin-page-title">
            <span className="admin-page-title__eyebrow">{eyebrow}</span>
            {tournament.name}
          </span>
        }
        back={{ href: "/admin/tournaments", label: "← Back to tournaments" }}
      />

      {error ? (
        <p role="alert" className="form__error">
          {error}
        </p>
      ) : null}
      {sent ? (
        <Notice variant="done">
          Sent {sent} prize code(s). {unclaimed ?? "0"} left unclaimed.
        </Notice>
      ) : null}

      <TournamentForm isEditing={true} action={updateTournamentAction} tournament={tournament} />

      {tournament.hasPrizing ? (
        <PrizingPanel
          slug={tournament.slug}
          status={tournament.status}
          tournamentName={tournament.name}
          prizes={prizes}
          prizesSentAt={tournament.prizesSentAt ?? null}
        />
      ) : null}

      <StatBar
        actions={
          <>
            <CopyLinkButton path={`/events/${tournament.slug}`} />
            <Button href={`/admin/tournaments/${tournament.slug}/participants`}>
              Manage participants
            </Button>
            <Button href={`/admin/tournaments/${tournament.slug}/bracket`}>Manage bracket</Button>
            {tournament.status === "scheduled" || tournament.status === "running" ? (
              <CancelTournamentButton slug={tournament.slug} tournamentName={tournament.name} />
            ) : null}
            <DeleteTournamentButton slug={tournament.slug} tournamentName={tournament.name} />
          </>
        }
      />
    </>
  );
}

