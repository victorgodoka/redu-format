import type { EntryFee } from "../../events.ts";
import { getPool } from "../db/client.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { SavedTournamentsRepository } from "../repositories/saved-tournaments.repository.ts";
import type { PaymentStatus } from "./tournament.service.ts";

function repos() {
  const pool = getPool();
  return {
    registrations: new RegistrationsRepository(pool),
    saved: new SavedTournamentsRepository(pool),
  };
}

/** Free tournaments have nothing to pay; paid ones start pending until the admin confirms. */
function initialPaymentStatus(entry: EntryFee): PaymentStatus {
  return entry.type === "paid" ? "pending" : "not_required";
}

/**
 * Registers a public signup, or replaces the deck on an existing one for the
 * same tournament. Trusts the caller (register() in
 * app/events/[slug]/signup/actions.ts) to have already checked the event is
 * open, has a seat, and that the deck is legal and belongs to this player -
 * this layer only persists the result.
 */
export async function registerSignup(
  slug: string,
  input: { playerId: string; displayName: string; deckId: string; deckName: string; entry: EntryFee },
): Promise<void> {
  await repos().registrations.upsertPublicSignup(crypto.randomUUID(), slug, {
    playerId: input.playerId,
    displayName: input.displayName,
    deckId: input.deckId,
    deckName: input.deckName,
    initialPaymentStatus: initialPaymentStatus(input.entry),
  });
}

export async function cancelSignup(slug: string, playerId: string): Promise<void> {
  await repos().registrations.deletePublicSignup(slug, playerId);
}

/** The deck id this player registered for this tournament with, or null if not registered. */
export async function findSignupDeckId(slug: string, playerId: string): Promise<string | null> {
  const signup = await repos().registrations.findPublicSignup(slug, playerId);
  return signup?.deckId ?? null;
}

/** tournament slug -> deck id, for every public signup this player has. */
export async function listSignupsForPlayer(playerId: string): Promise<Map<string, string | null>> {
  const rows = await repos().registrations.listPublicSignupsForPlayer(playerId);
  return new Map(rows.map((r) => [r.slug, r.deckId]));
}

export async function saveTournament(playerId: string, slug: string): Promise<void> {
  await repos().saved.add(playerId, slug);
}

export async function unsaveTournament(playerId: string, slug: string): Promise<void> {
  await repos().saved.remove(playerId, slug);
}

export async function listSavedSlugsForPlayer(playerId: string): Promise<string[]> {
  return repos().saved.listSlugsForPlayer(playerId);
}
