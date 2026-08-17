import type { EntryFee } from "../../events.ts";
import { isHttpUrl } from "../../safe-url.ts";
import { getPool } from "../db/client.ts";
import { RegistrationsRepository, type PublicSignup } from "../repositories/registrations.repository.ts";
import { SavedTournamentsRepository } from "../repositories/saved-tournaments.repository.ts";
import { dropFromStartedTournament, hasBracket } from "./results.service.ts";
import { setParticipantPayment, type PaymentStatus } from "./tournament.service.ts";

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
  input: {
    playerId: string;
    nexusIdentityKey: string;
    displayName: string;
    deckId: string;
    deckName: string;
    entry: EntryFee;
  },
): Promise<void> {
  await repos().registrations.upsertPublicSignup(crypto.randomUUID(), slug, {
    playerId: input.playerId,
    nexusIdentityKey: input.nexusIdentityKey,
    displayName: input.displayName,
    deckId: input.deckId,
    deckName: input.deckName,
    initialPaymentStatus: initialPaymentStatus(input.entry),
  });
}

export async function cancelSignup(slug: string, playerId: string): Promise<void> {
  await repos().registrations.deletePublicSignup(slug, playerId);
}

export type DropOutcome = "left" | "blocked" | "dropped";

/**
 * Leaving before the bracket starts just deletes the registration outright -
 * free tournaments, and paid ones with no confirmed payment yet, are free to
 * walk away and re-register later. Once a payment is confirmed pre-start,
 * only Staff can undo that (returns "blocked" so the UI can point there).
 * Once the bracket has started, this is a real drop with in-bracket
 * consequences (an automatic loss, tiebreaker impact) instead of a delete.
 */
export async function dropRegistration(slug: string, playerId: string): Promise<DropOutcome> {
  const { registrations } = repos();
  const signup = await registrations.findPublicSignup(slug, playerId);
  if (!signup) return "blocked";

  if (await hasBracket(slug)) {
    await dropFromStartedTournament(slug, signup.registrationId);
    return "dropped";
  }

  if (signup.paymentStatus === "confirmed") return "blocked";

  await registrations.deletePublicSignup(slug, playerId);
  return "left";
}

/** The deck id this player registered for this tournament with, or null if not registered. */
export async function findSignupDeckId(slug: string, playerId: string): Promise<string | null> {
  const signup = await repos().registrations.findPublicSignup(slug, playerId);
  return signup?.deckId ?? null;
}

/** This player's registrations.id for this tournament, or null if not registered - what match reporting keys off. */
export async function findMyRegistrationId(slug: string, playerId: string): Promise<string | null> {
  const signup = await repos().registrations.findPublicSignup(slug, playerId);
  return signup?.registrationId ?? null;
}

/** The full signup row (registration id, deck, payment status) - what the signup page needs to decide which drop UI to show. */
export async function findMySignup(slug: string, playerId: string): Promise<PublicSignup | null> {
  return repos().registrations.findPublicSignup(slug, playerId);
}

export type SubmitProofOutcome = "saved" | "not_registered" | "already_confirmed" | "invalid_url";

/**
 * The player's side of the doc's "player (or Staff) attaches proof" step.
 * Submitting always leaves the status at "pending" for Staff to review - a
 * player can never self-confirm, and re-submitting after a contest simply
 * goes back to "pending" rather than staying "contested".
 */
export async function submitPaymentProof(
  slug: string,
  playerId: string,
  proofUrl: string,
  displayName: string,
): Promise<SubmitProofOutcome> {
  if (!isHttpUrl(proofUrl)) return "invalid_url";

  const signup = await repos().registrations.findPublicSignup(slug, playerId);
  if (!signup) return "not_registered";
  if (signup.paymentStatus === "confirmed") return "already_confirmed";

  await setParticipantPayment(slug, signup.registrationId, {
    status: "pending",
    proofUrl,
    by: displayName,
  });
  return "saved";
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
