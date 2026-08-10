"use server";

import { revalidatePath } from "next/cache";
import { fetchProfile, getSession, MAX_SIGNUPS } from "@/lib/auth";
import { deckLegality } from "@/lib/nexus-parse";
import { seatsLeft } from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
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
  if (new Date(event.startsAt) < new Date()) {
    return { error: "That event has already finished." };
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

  const signups = (session.signups ?? []).filter((s) => s.e !== slug);
  signups.push({ e: slug, d: deck.id });
  session.signups = signups.slice(-MAX_SIGNUPS);
  await session.save();

  revalidatePath(`/events/${slug}/signup`);
  revalidatePath("/events");
  return {};
}

export async function cancel(form: FormData) {
  const slug = String(form.get("slug") ?? "");

  const session = await getSession();
  if (!session.token) return;

  session.signups = (session.signups ?? []).filter((s) => s.e !== slug);
  await session.save();

  revalidatePath(`/events/${slug}/signup`);
  revalidatePath("/events");
}
