import { assignPrizes, PRIZE_TIERS, type Prize, type PrizeTier } from "../../prizing.ts";
import { getPool } from "../db/client.ts";
import { PlacingsRepository } from "../repositories/placings.repository.ts";
import { PrizesRepository, type PrizeRow } from "../repositories/prizes.repository.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { TournamentsRepository } from "../repositories/tournaments.repository.ts";
import { logAction } from "./audit.service.ts";
import { notify } from "./notifications.service.ts";

export type { PrizeRow };

function repos() {
  const pool = getPool();
  return {
    prizes: new PrizesRepository(pool),
    placings: new PlacingsRepository(pool),
    registrations: new RegistrationsRepository(pool),
    tournaments: new TournamentsRepository(pool),
  };
}

export async function listPrizes(slug: string): Promise<PrizeRow[]> {
  const id = await repos().tournaments.findIdBySlug(slug);
  return id ? repos().prizes.listForTournament(id) : [];
}

/**
 * Codes can be added and removed for as long as the tournament is still
 * scheduled or running - once it is finished the list is what gets mailed out,
 * so it stops moving. Saved as a batch, since that is how the form collects
 * them; the tournament's state is checked once for the whole batch.
 */
export async function addPrizes(
  slug: string,
  entries: { tier: PrizeTier; code: string }[],
): Promise<number> {
  const { prizes, tournaments } = repos();
  const event = await tournaments.findBySlug(slug);
  if (!event) throw new Error(`Tournament "${slug}" does not exist`);
  if (event.status === "finished" || event.status === "cancelled") {
    throw new Error("Prizing is closed for this tournament.");
  }

  const id = (await tournaments.findIdBySlug(slug))!;
  for (const entry of entries) {
    await prizes.insert(crypto.randomUUID(), id, entry.tier, entry.code);
  }

  await logAction({
    action: "prize.add",
    target: slug,
    detail: `Added ${entries.length} prize code(s): ${entries.map((e) => e.tier).join(", ")}`,
  }, [`/admin/tournaments/${slug}`]);
  return entries.length;
}

export async function removePrize(slug: string, prizeId: string): Promise<boolean> {
  const { prizes, tournaments } = repos();
  const id = await tournaments.findIdBySlug(slug);
  if (!id) throw new Error("ID not found.");;
  return prizes.delete(id, prizeId);
}

export type PrizeSendResult = { sent: number; unclaimed: number };

/**
 * Mails every prize code out, one per finisher, and records who got what.
 * Only ever runs on a finished tournament, and only once: the claim on
 * `prizes_sent_at` is what makes a double-clicked button harmless.
 *
 * Drops and disqualifications are excluded outright - including from the
 * participation codes - and so is anyone whose registration was entered by
 * hand rather than through a signup, since there is no account to mail.
 */
export async function sendPrizes(slug: string): Promise<PrizeSendResult> {
  const { prizes, placings, registrations, tournaments } = repos();
  const event = await tournaments.findBySlug(slug);
  if (!event) throw new Error(`Tournament "${slug}" does not exist`);
  if (event.status !== "finished") throw new Error("The tournament has to be finished first.");

  const tournamentId = (await tournaments.findIdBySlug(slug))!;
  if (!(await tournaments.claimPrizeSend(tournamentId, new Date().toISOString()))) {
    throw new Error("Prizing has already been sent for this tournament.");
  }

  try {
    const [pool, standings, participants, accounts] = await Promise.all([
      prizes.listForTournament(tournamentId),
      placings.listForTournament(tournamentId),
      registrations.findByTournamentSlug(slug),
      registrations.listPlayerIdsBySlug(slug),
    ]);

    const playerIds = new Map(accounts.map((a) => [a.registrationId, a.playerId]));
    const out = new Set(
      participants.filter((p) => p.droppedAt || p.disqualifiedAt).map((p) => p.id),
    );

    const finishers = standings
      .filter((s) => !out.has(s.registrationId) && playerIds.has(s.registrationId))
      .map((s) => ({ registrationId: s.registrationId, place: s.place }));

    const unsent: Prize[] = pool
      .filter((p) => !p.sentAt)
      .map((p) => ({ id: p.id, tier: p.tier, code: p.code }));
    const assignments = assignPrizes(finishers, unsent);
    if (assignments.length === 0) {
      await tournaments.releasePrizeSend(tournamentId);
      return { sent: 0, unclaimed: unsent.length };
    }

    const byId = new Map(unsent.map((p) => [p.id, p]));
    for (const assignment of assignments) {
      const prize = byId.get(assignment.prizeId)!;
      await notify({
        id: crypto.randomUUID(),
        audience: "player",
        playerId: playerIds.get(assignment.registrationId)!,
        kind: "prize.code",
        title: `${event.name} - your ${PRIZE_TIERS[prize.tier].label} code`,
        body: prizeMessage(event.name, prize),
        metadata: { slug, tier: prize.tier },
        // One code, one alert, forever - the fingerprint is the code's own id.
        fingerprint: await sha256(`prize:${prize.id}`),
      });
    }

    await prizes.markSent(tournamentId, assignments);
    return { sent: assignments.length, unclaimed: unsent.length - assignments.length };
  } catch (error) {
    await repos().tournaments.releasePrizeSend(tournamentId);
    throw error;
  }
}

function prizeMessage(tournamentName: string, prize: Prize): string {
  return [
    `You earned a **${PRIZE_TIERS[prize.tier].label}** prize at **${tournamentName}**.`,
    "",
    "Your redemption code:",
    "",
    `\`${prize.code}\``,
  ].join("\n");
}

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}
