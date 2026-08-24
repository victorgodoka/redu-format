import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import DeleteButton from "@/components/admin/DeleteButton";
import PrizingPanel from "@/components/admin/PrizingPanel";
import StatBar from "@/components/admin/StatBar";
import TournamentForm from "@/components/admin/TournamentForm";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import { listPrizes } from "@/lib/backend/services/prizing.service";
import { getTournament } from "@/lib/tournaments";
import {
  addPrizeAction,
  cancelTournamentAction,
  deleteTournamentAction,
  removePrizeAction,
  sendPrizesAction,
  updateTournamentAction,
} from "../actions";

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

  return (
    <>
      <AdminPageHead
        title={tournament.name}
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
          prizes={prizes}
          prizesSentAt={tournament.prizesSentAt ?? null}
          addPrizeAction={addPrizeAction}
          removePrizeAction={removePrizeAction}
          sendPrizesAction={sendPrizesAction}
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
