import { events as seedTournaments, type Structure, type TournamentEvent } from "./events.ts";

export type TournamentDraft = Omit<TournamentEvent, "slug" | "taken">;

export type Participant = {
  id: string;
  name: string;
  deckName: string;
};

/**
 * In-memory admin store for upcoming tournaments, seeded from the events mock.
 * Every function below is async and returns the same shapes a real API/DB call
 * would, so swapping the bodies for fetch() or a query later needs no changes
 * on the calling pages/actions.
 * ponytail: per-process memory, resets on restart/deploy — a real store
 * (Postgres, etc.) is the upgrade once a backend exists. Finished events stay
 * in lib/events.ts as a static archive; this store only covers tournaments an
 * admin can still create, edit or delete.
 */
let tournaments: TournamentEvent[] = seedTournaments.map((e) => ({ ...e }));
const participantsByTournament = new Map<string, Participant[]>();

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

function uniqueSlug(base: string): string {
  let slug = base;
  let n = 2;
  while (tournaments.some((t) => t.slug === slug)) slug = `${base}-${n++}`;
  return slug;
}

export async function listTournaments(): Promise<TournamentEvent[]> {
  return tournaments;
}

export async function getTournament(slug: string): Promise<TournamentEvent | null> {
  return tournaments.find((t) => t.slug === slug) ?? null;
}

export async function createTournament(draft: TournamentDraft): Promise<TournamentEvent> {
  const tournament: TournamentEvent = {
    ...draft,
    slug: uniqueSlug(slugify(draft.name)),
    taken: 0,
  };
  tournaments = [...tournaments, tournament];
  return tournament;
}

export async function updateTournament(
  slug: string,
  draft: TournamentDraft & { taken: number },
): Promise<TournamentEvent | null> {
  const index = tournaments.findIndex((t) => t.slug === slug);
  if (index === -1) return null;

  const updated: TournamentEvent = { ...draft, slug };
  tournaments = tournaments.map((t, i) => (i === index ? updated : t));
  return updated;
}

export async function deleteTournament(slug: string): Promise<boolean> {
  const before = tournaments.length;
  tournaments = tournaments.filter((t) => t.slug !== slug);
  participantsByTournament.delete(slug);
  return tournaments.length < before;
}

export async function listParticipants(slug: string): Promise<Participant[]> {
  return participantsByTournament.get(slug) ?? [];
}

export async function addParticipant(
  slug: string,
  input: { name: string; deckName: string },
): Promise<Participant> {
  const participant: Participant = { id: crypto.randomUUID(), ...input };
  const list = participantsByTournament.get(slug) ?? [];
  participantsByTournament.set(slug, [...list, participant]);
  return participant;
}

export async function removeParticipant(slug: string, id: string): Promise<boolean> {
  const list = participantsByTournament.get(slug) ?? [];
  const next = list.filter((p) => p.id !== id);
  participantsByTournament.set(slug, next);
  return next.length !== list.length;
}

export type { Structure, TournamentEvent };
