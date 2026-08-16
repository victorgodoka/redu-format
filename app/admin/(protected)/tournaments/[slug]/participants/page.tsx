import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import ParticipantList from "@/components/admin/ParticipantList";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import { hasBracket } from "@/lib/backend/services/results.service";
import { getTournament, listParticipants } from "@/lib/tournaments";
import {
  addParticipantAction,
  confirmPaymentAction,
  contestPaymentAction,
  editParticipantDeckAction,
  overrideParticipantDeckAction,
  removeParticipantAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Tournament participants | REDU Format",
  robots: { index: false, follow: false },
};

export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const [participants, started] = await Promise.all([listParticipants(slug), hasBracket(slug)]);
  const isPaid = tournament.entry.type === "paid";

  return (
    <>
      <AdminPageHead
        title={`${tournament.name} · Participants`}
        back={{ href: `/admin/tournaments/${slug}`, label: "← Back to tournament" }}
      />

      {error ? (
        <p role="alert" className="form__error">
          {error}
        </p>
      ) : null}

      <form action={addParticipantAction} className="form form--flex">
        <input type="hidden" name="slug" value={slug} />
        <FormField label="Duelist name" htmlFor="name">
          <Input id="name" name="name" type="text" required />
        </FormField>
        <FormField label="Deck UUID" htmlFor="deckName">
          <Input id="deckName" name="deckName" type="text" placeholder="Dueling Nexus deck UUID" required />
        </FormField>
        <Button variant="solid" type="submit">
          Add participant
        </Button>
      </form>

      {participants.length === 0 ? (
        <EmptyState message="No participants registered yet." />
      ) : (
        <ParticipantList
          slug={slug}
          participants={participants}
          isPaid={isPaid}
          started={started}
          confirmPaymentAction={confirmPaymentAction}
          contestPaymentAction={contestPaymentAction}
          editParticipantDeckAction={editParticipantDeckAction}
          overrideParticipantDeckAction={overrideParticipantDeckAction}
          removeParticipantAction={removeParticipantAction}
        />
      )}
    </>
  );
}
