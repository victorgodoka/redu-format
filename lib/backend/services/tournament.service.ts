import type { Structure, TournamentEvent } from "../../events.ts";
import { getPool } from "../db/client.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { TournamentsRepository, type TournamentDraft } from "../repositories/tournaments.repository.ts";

export type { TournamentDraft };
export type PaymentStatus = "pending" | "confirmed" | "contested" | "not_required";

export type Participant = {
  id: string;
  name: string;
  deckName: string;
  /** "not_required" for a free tournament's entry; otherwise the usual pending/confirmed/contested. */
  paymentStatus: PaymentStatus;
  proofUrl: string | null;
  /** Display name of whoever last set the status; full history lives in the audit log. */
  paymentBy: string | null;
  paymentAt: string | null;
  /** Where the registration came from - a public signup or an admin adding someone manually. */
  source: "public_signup" | "admin_manual";
};

// Strips combining diacritics (U+0300-U+036F) left behind by NFKD, e.g. "é" -> "e".
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(DIACRITICS, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tournament"
  );
}

function repos() {
  const pool = getPool();
  return { tournaments: new TournamentsRepository(pool), registrations: new RegistrationsRepository(pool) };
}

async function uniqueSlug(base: string): Promise<string> {
  const { tournaments } = repos();
  let slug = base;
  let n = 2;
  while (await tournaments.existsBySlug(slug)) slug = `${base}-${n++}`;
  return slug;
}

export async function listTournaments(): Promise<TournamentEvent[]> {
  return repos().tournaments.findAll();
}

export async function getTournament(slug: string): Promise<TournamentEvent | null> {
  return repos().tournaments.findBySlug(slug);
}

export async function createTournament(draft: TournamentDraft): Promise<TournamentEvent> {
  const { tournaments } = repos();
  const slug = await uniqueSlug(slugify(draft.name));
  await tournaments.insert(crypto.randomUUID(), slug, draft);
  return { ...draft, slug, taken: 0 };
}

export async function updateTournament(
  slug: string,
  draft: TournamentDraft,
): Promise<TournamentEvent | null> {
  const { tournaments } = repos();
  const ok = await tournaments.update(slug, draft);
  if (!ok) return null;
  // taken is derived (see tournaments.repository.ts), not something the caller sets - re-read it.
  return tournaments.findBySlug(slug);
}

export async function deleteTournament(slug: string): Promise<boolean> {
  return repos().tournaments.delete(slug);
}

export async function listParticipants(slug: string): Promise<Participant[]> {
  return repos().registrations.findByTournamentSlug(slug);
}

export async function addParticipant(
  slug: string,
  input: { name: string; deckName: string },
): Promise<Participant> {
  const id = crypto.randomUUID();
  const ok = await repos().registrations.insert(id, slug, input);
  if (!ok) throw new Error(`Tournament "${slug}" does not exist`);
  return {
    id,
    ...input,
    paymentStatus: "pending",
    proofUrl: null,
    paymentBy: null,
    paymentAt: null,
    source: "admin_manual",
  };
}

export async function removeParticipant(slug: string, id: string): Promise<boolean> {
  return repos().registrations.remove(slug, id);
}

/** status stays "pending" until confirmed at least once; contest never clears proofUrl. */
export async function setParticipantPayment(
  slug: string,
  id: string,
  update: { status: PaymentStatus; proofUrl: string | null; by: string },
): Promise<Participant | null> {
  const { registrations } = repos();
  const ok = await registrations.updatePayment(slug, id, update);
  if (!ok) return null;
  return registrations.findOne(slug, id);
}

export type { Structure, TournamentEvent };
