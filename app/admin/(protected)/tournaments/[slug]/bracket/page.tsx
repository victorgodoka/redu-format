import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import AdminPageHead from "@/components/admin/AdminPageHead";
import BracketRounds from "@/components/admin/BracketRounds";
import DeleteButton from "@/components/admin/DeleteButton";
import StartBracketForm from "@/components/admin/StartBracketForm";
import StatBar from "@/components/admin/StatBar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { verifyTournament } from "@/lib/backend/services/duel-verification.service";
import { closeOverdueMatches, getBracketView, getPlacings } from "@/lib/backend/services/results.service";
import { DURATION_MODES, formatDate, formatTime } from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
import {
  completeBracketAction,
  extendRoundAction,
  nextRoundAction,
  repairRoundAction,
  updateBracketStatusAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Tournament bracket | REDU Format",
  robots: { index: false, follow: false },
};

export default async function BracketPage({
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

  // Settle anything the clock already decided - but *after* the response, not
  // during the render. Writing results mid-render makes the HTML and the RSC
  // payload disagree about which matches are settled, which surfaces as a
  // hydration mismatch in the result form.
  if (tournament.status === "running") {
    after(() => closeOverdueMatches(slug).catch(() => null));
    after(() => verifyTournament(slug).catch(() => null));
  }

  const view = await getBracketView(slug);
  const placings = view?.status === "complete" ? await getPlacings(slug) : [];

  const hasOpenMatches = view
    ? view.matches.some((m) => m.active && !m.hasResult && !m.bye)
    : false;

  // Named so the extend-deadline control never reads as a bare "extend
  // round" with no idea which one - double elim can have more than one side
  // open at once, so this joins every round currently taking reports.
  const openRoundLabel = view
    ? [...new Set(view.matches.filter((m) => m.active && !m.hasResult && !m.bye).map((m) => m.round))]
        .map((r) => view.matches.find((m) => m.round === r)?.label ?? `Round ${r}`)
        .join(" & ")
    : "";

  // A locked round can always be advanced by hand: in a same-day tournament
  // that just skips the rest of the cleanup window, and in a long-duration one
  // it is the only way the next round ever starts.
  const canStartNextRound = view !== null && view.status !== "complete" && (!hasOpenMatches || view.clock.locked);

  // Re-pairing is a Swiss-only escape hatch, and only while the Swiss rounds
  // are still what the tournament is running - once the top cut exists it was
  // cut from these standings and cannot be unwound from here.
  const canRepairRound =
    view !== null &&
    view.status === "stage-one" &&
    tournament.structure === "swiss" &&
    view.round >= 1;

  return (
    <>
      <AdminPageHead
        title={`${tournament.name} · Bracket`}
        back={{ href: `/admin/tournaments/${slug}`, label: "← Back to tournament" }}
      />

      {error ? (
        <p role="alert" className="form__error">
          {error}
        </p>
      ) : null}

      {view && view.status !== "complete" ? (
        <p className="lede">
          {DURATION_MODES[tournament.durationMode].label} · Round {view.round} ·{" "}
          {view.clock.locked
            ? view.clock.awaitingModerator
              ? "locked, waiting for you to start the next round"
              : view.clock.nextRoundAt
                ? `locked - next round starts automatically ${formatDate(view.clock.nextRoundAt)} at ${formatTime(view.clock.nextRoundAt)}`
                : "locked"
            : view.clock.deadlineAt
              ? `open until ${formatDate(view.clock.deadlineAt)} at ${formatTime(view.clock.deadlineAt)}`
              : "open"}
        </p>
      ) : null}

      {view && view.status !== "complete" && hasOpenMatches ? (
        <form action={updateBracketStatusAction}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit">Update bracket status</Button>
        </form>
      ) : null}

      {!view ? (
        <EmptyState
          message={
            <>
              No bracket started yet. Starting one locks in the {tournament.taken} currently
              registered {tournament.taken === 1 ? "participant" : "participants"} as the field -
              anyone who registers afterward won&apos;t be added automatically.
            </>
          }
          action={<StartBracketForm slug={slug} />}
        />
      ) : (
        <BracketRounds
          slug={slug}
          view={view}
          placings={placings}
          actions={
            <>
              {view.status !== "complete" && hasOpenMatches ? (
                <StatBar
                  actions={
                    <form action={extendRoundAction} className="extend-round">
                      <input type="hidden" name="slug" value={slug} />
                      <span className="extend-round__label">Extend {openRoundLabel} deadline</span>
                      <div className="extend-round__row">
                        <input
                          type="number"
                          name="amount"
                          min={1}
                          placeholder="e.g. 4"
                          required
                          aria-label="Amount of time to extend the deadline by"
                        />
                        <select name="unit" defaultValue="hours" aria-label="Unit">
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                        <Button type="submit">Extend</Button>
                      </div>
                    </form>
                  }
                />
              ) : null}
              {canStartNextRound ? (
                <StatBar
                  actions={
                    <>
                      <form action={nextRoundAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <Button type="submit">
                          {view.clock.locked && hasOpenMatches
                            ? "Start next round now"
                            : "Generate next round"}
                        </Button>
                      </form>
                      <form action={completeBracketAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <Button variant="solid" type="submit">
                          Complete tournament
                        </Button>
                      </form>
                    </>
                  }
                />
              ) : null}
              {canRepairRound ? (
                <StatBar
                  actions={
                    <DeleteButton
                      action={repairRoundAction}
                      hidden={{ slug }}
                      label={`Re-pair round ${view.round}`}
                      confirmText={`Re-pair round ${view.round}? Every match in it is voided - results, reports and duel rooms included - and the round is drawn again from the current standings, including anyone who registered after the bracket was generated. Swiss pairings are not deterministic, so who plays whom will likely change even if nothing else did. Players are notified. This cannot be undone.`}
                    />
                  }
                />
              ) : null}
            </>
          }
        />
      )}
    </>
  );
}
