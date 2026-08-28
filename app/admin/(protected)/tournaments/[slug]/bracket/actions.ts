"use server";

import { revalidatePath } from "next/cache";
import {
  closeOverdueMatches,
  completeBracket,
  dismissNoShow,
  enterMatchResult,
  extendCurrentRoundDeadline,
  generateNextRound,
  repairRound,
  RepairConfirmationRequired,
  startBracket,
  swapPlayers,
} from "@/lib/backend/services/results.service";
import { verifyTournament } from "@/lib/backend/services/duel-verification.service";
import { getTournament } from "@/lib/tournaments";
import { logAction } from "@/lib/backend/services/audit.service";
import { ActionResult, actionError, actionSuccess } from "@/lib/actions-utils";
import { SuccessMessages } from "@/lib/success";

export async function startBracketAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const event = await getTournament(slug);
  if (!event) return actionError("That tournament no longer exists.");

  const seedOrderRaw = String(form.get("seedOrder") ?? "");
  const seedOrder = seedOrderRaw ? seedOrderRaw.split(",").filter(Boolean) : undefined;

  try {
    await startBracket(slug, event, seedOrder);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not start the bracket.");
  }

  await logAction(
    {
      action: "bracket.start",
      target: slug,
      detail: `Started the bracket for "${event.name}"`,
    },
    [`/admin/tournaments/${slug}/bracket`]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.started);
}

export async function enterResultAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  const winner = String(form.get("winner") ?? "");
  const winnerGames = Number(form.get("winnerGames") ?? 1);
  const loserGames = Number(form.get("loserGames") ?? 0);
  const confirmRepair = form.get("confirmRepair") === "on";
  if (!slug || !matchId) return actionError("");
  if (winner !== "player1" && winner !== "player2") return actionError("Pick which player won.");
  if (!Number.isInteger(winnerGames) || !Number.isInteger(loserGames) || loserGames >= winnerGames) {
    return actionError("The winner has to have won more games than the loser.");
  }

  const p1Won = winner === "player1";
  try {
    await enterMatchResult(
      slug,
      matchId,
      p1Won ? winnerGames : loserGames,
      p1Won ? loserGames : winnerGames,
      0,
      { confirm: confirmRepair }
    );
  } catch (err) {
    if (err instanceof RepairConfirmationRequired)
      return actionError(`${err.message} Check the box below and save again.`);
    return actionError(err instanceof Error ? err.message : "Could not save that result.");
  }

  await logAction(
    {
      action: "bracket.result",
      target: slug,
      detail: `Entered a match result in "${slug}" (${
        p1Won ? `${winnerGames}-${loserGames}` : `${loserGames}-${winnerGames}`
      })${confirmRepair ? " - repair confirmed, voiding downstream matches" : ""}`,
    },
    [`/admin/tournaments/${slug}/bracket`, `/events/${slug}`]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.resultEntered);
}

export async function dismissNoShowAdminAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  const actorDisplayName = String(form.get("actorDisplayName") ?? "");
  if (!slug || !matchId) return actionError("Missing slug or matchId.");

  try {
    await dismissNoShow(slug, matchId, actorDisplayName);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not dismiss no-show.");
  }

  await logAction(
    {
      action: "bracket.no_show_dismissed",
      target: slug,
      detail: `Dismissed the no-show report on a match in "${slug}"`,
    },
    [`/admin/tournaments/${slug}/bracket`, `/events/${slug}`]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.noShowDismissed);
}

export async function nextRoundAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return actionError("Missing slug.");

  try {
    const { advanced } = await closeOverdueMatches(slug);
    if (!advanced) await generateNextRound(slug);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not generate next round.");
  }

  await logAction(
    {
      action: "bracket.round",
      target: slug,
      detail: `Advanced "${slug}" to the next round`,
    },
    [`/admin/tournaments/${slug}/bracket`]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.roundAdvanced);
}

export async function extendRoundAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const amount = Number(form.get("amount") ?? "");
  const unit = String(form.get("unit") ?? "hours");
  if (!slug || !Number.isFinite(amount) || amount <= 0) return actionError("Invalid amount.");

  const hours = unit === "days" ? amount * 24 : amount;
  const { extended } = await extendCurrentRoundDeadline(slug, hours);
  if (extended === 0) return actionError("No active matches to extend.");

  await logAction(
    {
      action: "bracket.extend_round",
      target: slug,
      detail: `Extended the deadline of ${extended} active match(es) in "${slug}" by ${amount} ${unit}`,
    },
    [`/admin/tournaments/${slug}/bracket`]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.roundExtended);
}

export async function updateBracketStatusAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return;

  await verifyTournament(slug).catch(() => null);
  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
}

export async function repairRoundAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return actionError("Missing slug.");

  let result;
  try {
    result = await repairRound(slug);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not re-pair that round.");
  }

  await logAction(
    {
      action: "bracket.repair_round",
      target: slug,
      detail: `Re-paired round ${result.round} in "${slug}" - voided ${result.voidedMatches} match(es), paired ${result.pairedMatches}, added ${result.addedPlayers} late entrant(s)`,
    },
    [`/admin/tournaments/${slug}/bracket`, `/events/${slug}`]
  );
  
  return actionSuccess(undefined, SuccessMessages.bracket.roundRepaired);
}

export async function swapPlayersAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const playerAId = String(form.get("playerAId") ?? "");
  const playerBId = String(form.get("playerBId") ?? "");
  if (!slug || !playerAId || !playerBId) return actionError("Missing required fields.");

  let result;
  try {
    result = await swapPlayers(slug, playerAId, playerBId);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not swap those players.");
  }

  await logAction(
    {
      action: "bracket.swap_players",
      target: slug,
      detail: `Swapped two players between matches ${result.matchAId} and ${result.matchBId} in "${slug}"`,
    },
    [`/admin/tournaments/${slug}/bracket`, `/events/${slug}`]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.playersSwapped);
}

export async function completeBracketAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return actionError("Missing slug.");

  try {
    await completeBracket(slug);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Could not complete bracket.");
  }

  await logAction(
    {
      action: "bracket.complete",
      target: slug,
      detail: `Completed the bracket for "${slug}" and froze final standings`,
    },
    [`/admin/tournaments/${slug}/bracket`, "/leaderboard", `/events/${slug}`, "/dashboard"]
  );

  return actionSuccess(undefined, SuccessMessages.bracket.completed);
}
