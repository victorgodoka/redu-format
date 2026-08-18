import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import BracketRounds from "@/components/admin/BracketRounds";
import StartBracketForm from "@/components/admin/StartBracketForm";
import StatBar from "@/components/admin/StatBar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { closeOverdueMatches, getBracketView, getPlacings } from "@/lib/backend/services/results.service";
import { DURATION_MODES, formatDate, formatTime } from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
import { completeBracketAction, extendRoundAction, nextRoundAction } from "./actions";

export const metadata: Metadata = {
  title: "Tournament bracket | REDU Format",
  robots: { index: false, follow: false },
};

export default async function BracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  // Settle anything the clock already decided before rendering, so the page
  // never shows a round the deadline has moved past. The cron does the same
  // sweep on its own schedule; this only makes the admin view immediate.
  if (tournament.status === "running") await closeOverdueMatches(slug).catch(() => null);

  const view = await getBracketView(slug);
  const placings = view?.status === "complete" ? await getPlacings(slug) : [];

  const hasOpenMatches = view
    ? view.matches.some((m) => m.active && !m.hasResult && !m.bye)
    : false;

  // A locked round can always be advanced by hand: in a same-day tournament
  // that just skips the rest of the cleanup window, and in a long-duration one
  // it is the only way the next round ever starts.
  const canStartNextRound = view !== null && view.status !== "complete" && (!hasOpenMatches || view.clock.locked);

  return (
    <>
      <AdminPageHead
        title={`${tournament.name} · Bracket`}
        back={{ href: `/admin/tournaments/${slug}`, label: "← Back to tournament" }}
      />

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
                    <form action={extendRoundAction} className="payment-controls__confirm">
                      <input type="hidden" name="slug" value={slug} />
                      <input
                        type="number"
                        name="hours"
                        min={1}
                        placeholder="Hours"
                        required
                        aria-label="Hours to extend the current round's deadline by"
                      />
                      <Button type="submit">Extend round deadline</Button>
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
            </>
          }
        />
      )}
    </>
  );
}
