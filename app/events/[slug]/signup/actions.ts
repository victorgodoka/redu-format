"use server";

import { revalidatePath } from "next/cache";
import { fetchProfile, getSession } from "@/lib/auth";
import { deckLegality } from "@/lib/nexus-parse";
import { seatsLeft } from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
import {
  dropRegistration,
  registerSignup,
  submitPaymentProof,
} from "@/lib/backend/services/registration.service";
import { findPlayerIdByToken, identityKey, resolvePlayerId } from "@/lib/backend/services/player.service";
import { describeError, validateDeck } from "@/lib/validateDecks";

export type SignupState = { error?: string };

export async function register(
  _prev: SignupState,
  form: FormData,
): Promise<SignupState> {
  const slug = String(form.get("slug") ?? "");
  const deckId = String(form.get("deckId") ?? "");

  const session = await getSession();
  if (!session.token) return { error: "Your session expired. Sign in again." };

  const event = await getTournament(slug);
  if (!event) return { error: "That event no longer exists." };
  if (event.status === "cancelled") return { error: "That event was cancelled." };
  if (event.status !== "scheduled") {
    return { error: "This event has already started - registration is closed." };
  }
  if (seatsLeft(event) === 0) return { error: "That event is sold out." };

  if (!deckId) return { error: "Pick a deck to register." };

  // Never trust the submitted id: it must be one of this user's own decks.
  const profile = await fetchProfile(session.token);
  if (!profile) return { error: "Dueling Nexus rejected your session." };

  const deck = profile.decks.find((d) => d.id === deckId);
  if (!deck) return { error: "That deck is not on your account." };

  const illegal = deckLegality(deck);
  if (illegal) return { error: illegal };

  // The picker disables illegal decks, but a hand-made POST would skip that,
  // so the card pool, banlist and errata rules are re-checked here.
  const list = profile.deckLists.find((d) => d.id === deckId);
  if (!list) return { error: "That deck list could not be read." };

  const { errors } = validateDeck(list);
  if (errors.length > 0) {
    return {
      error: `${deck.name} is not legal for REDU Format: ${describeError(errors[0])}${
        errors.length > 1 ? ` (and ${errors.length - 1} more)` : ""
      }`,
    };
  }

  const playerId = await resolvePlayerId(session.token, {
    name: profile.name,
    avatar: profile.avatar,
    contributor: profile.contributor,
    contributorTime: profile.contributorTime,
  });

  await registerSignup(slug, {
    playerId,
    nexusIdentityKey: identityKey(session.token),
    displayName: profile.name,
    deckId: deck.id,
    deckName: deck.name,
    entry: event.entry,
  });

  revalidatePath(`/events/${slug}/signup`);
  revalidatePath("/events");
  return {};
}

/**
 * Fire-and-forget, same as the admin bracket actions: the page already gates
 * which button/state is shown (payment confirmed pre-start, bracket started)
 * from server-rendered data, so a rejected drop here (e.g. payment got
 * confirmed a moment after the page loaded) is just a safety-net no-op.
 */
export async function cancel(form: FormData) {
  const slug = String(form.get("slug") ?? "");

  const session = await getSession();
  if (!session.token) return;

  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) return;

  await dropRegistration(slug, playerId);

  revalidatePath(`/events/${slug}/signup`);
  revalidatePath(`/events/${slug}`);
  revalidatePath("/events");
  revalidatePath("/dashboard");
}

/** The player's side of attaching a payment proof - always leaves it pending for Staff to confirm. */
export async function submitProof(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const proofUrl = String(form.get("proofUrl") ?? "").trim();
  if (!slug || !proofUrl) return;

  const session = await getSession();
  if (!session.token) return;

  const profile = await fetchProfile(session.token);
  if (!profile) return;

  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) return;

  await submitPaymentProof(slug, playerId, proofUrl, profile.name);

  revalidatePath(`/events/${slug}/signup`);
  revalidatePath(`/events/${slug}`);
}
