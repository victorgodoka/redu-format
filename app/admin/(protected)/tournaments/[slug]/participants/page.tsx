import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import EmptyState from "@/components/ui/EmptyState";
import { listPlayerNames } from "@/lib/backend/services/player.service";
import { hasBracket } from "@/lib/backend/services/results.service";
import { formatEntry } from "@/lib/events";
import { getTournament, listParticipants, Participant } from "@/lib/tournaments";
import ParticipantCards from "@/components/admin/ParticipantCards";
import ParticipantAddForm from "@/components/admin/ParticipantAddForm";

type StatusFilter = "all" | "active" | "dropped" | "disqualified";

export const metadata: Metadata = {
  title: "Tournament participants | REDU Format",
  robots: { index: false, follow: false },
};

function statusOf(p: Participant): Exclude<StatusFilter, "all"> {
  if (p.disqualifiedAt) return "disqualified";
  if (p.droppedAt) return "dropped";
  return "active";
}

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const [participants, started, playerNames] = await Promise.all([
    listParticipants(slug),
    hasBracket(slug),
    listPlayerNames(),
  ]);

  const isPaid = tournament.entry.type === "paid";
  const eyebrow = `${formatEntry(tournament.entry)} · ${participants.length} ${participants.length === 1 ? "participant" : "participants"}`;
  const counts: Record<StatusFilter, number> = {
    all: participants.length,
    active: participants.filter((p) => statusOf(p) === "active").length,
    dropped: participants.filter((p) => statusOf(p) === "dropped").length,
    disqualified: participants.filter((p) => statusOf(p) === "disqualified").length,
  };

  const statusLabel: Record<StatusFilter, string> = {
    all: "All",
    active: "Active",
    dropped: "Dropped",
    disqualified: "Disqualified",
  };

  return (
    <>
      <AdminPageHead
        title={
          <span className="admin-page-title">
            <span className="admin-page-title__eyebrow">{eyebrow}</span>
            {tournament.name}
          </span>
        }
        back={{ href: `/admin/tournaments/${slug}`, label: "← Back to tournament" }}
      />

      <ParticipantAddForm slug={slug} playerNames={playerNames} />

      {participants.length === 0 ? (
        <EmptyState message="No participants registered yet." />
      ) : (
        <ParticipantCards
          slug={slug}
          isPaid={isPaid}
          started={started}
          participants={participants}
          tournamentName={tournament.name}
        />
      )}
    </>
  );
}
