import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import AdminPageHead from "@/components/admin/AdminPageHead";
import BracketRounds from "@/components/admin/BracketRounds";
import CompleteBracketButton from "@/components/admin/BracketRounds/CompleteBracketButton";
import ExtendRoundForm from "@/components/admin/BracketRounds/ExtendRoundForm";
import NextRoundButton from "@/components/admin/BracketRounds/NextRoundButton";
import RepairRoundButton from "@/components/admin/BracketRounds/RepairRoundButton";
import StartBracketForm from "@/components/admin/StartBracketForm";
import StatBar from "@/components/admin/StatBar";
import SwissBracketView from "@/components/admin/SwissBracketView";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { verifyTournament } from "@/lib/backend/services/duel-verification.service";
import {
  closeOverdueMatches,
  getBracketView,
  getPlacingsWithTiebreak,
} from "@/lib/backend/services/results.service";
import { DURATION_MODES, formatDate, formatTime, STRUCTURES } from "@/lib/events";
import { getTournament, listParticipants } from "@/lib/tournaments";
import { updateBracketStatusAction } from "./actions";

export const metadata: Metadata = {
  title: "Tournament bracket | REDU Format",
  robots: { index: false, follow: false },
};

export default async function BracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; tab?: string; round?: string }>;
}) {
  const { slug } = await params;
  const { error, tab, round } = await searchParams;

  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  if (tournament.status === "running") {
    after(() => closeOverdueMatches(slug).catch(() => null));
    after(() => verifyTournament(slug).catch(() => null));
  }

  const view = await getBracketView(slug);
  const placings = view?.status === "complete" ? await getPlacingsWithTiebreak(slug) : [];

  const hasOpenMatches = view
    ? view.matches.some((m) => m.active && !m.hasResult && !m.bye)
    : false;

  const openRoundLabel = view
    ? [...new Set(view.matches.filter((m) => m.active && !m.hasResult && !m.bye).map((m) => m.round))]
        .map((r) => view.matches.find((m) => m.round === r)?.label ?? `Round ${r}`)
        .join(" & ")
    : "";

  const canStartNextRound = view !== null && view.status !== "complete" && (!hasOpenMatches || view.clock.locked);

  const canRepairRound =
    view !== null &&
    view.status === "stage-one" &&
    tournament.structure === "swiss" &&
    view.round >= 1;

  const structureLabel =
    STRUCTURES[tournament.structure].label + (tournament.structure === "swiss" && tournament.topCut ? " + Top Cut" : "");
  const eyebrow = `${structureLabel} · ${tournament.taken} ${tournament.taken === 1 ? "player" : "players"}`;

  const defaultRound = view
    ? view.status === "stage-one"
      ? String(view.round)
      : view.topCutFormat !== null
        ? "topcut"
        : String(view.stageOneRounds)
    : "1";
  const selectedRound = round ?? defaultRound;
  const selectedTab = tab === "standings" ? "standings" : "bracket";

  const bracketActions = view ? (
    <>
      {view.status !== "complete" && hasOpenMatches ? (
        <StatBar
          actions={
            <ExtendRoundForm slug={slug} openRoundLabel={openRoundLabel} />
          }
        />
      ) : null}
      {canStartNextRound ? (
        <StatBar
          actions={
            <>
              <NextRoundButton
                slug={slug}
                label={view.clock.locked && hasOpenMatches ? "Start next round now" : "Generate next round"}
              />
              <CompleteBracketButton slug={slug} />
            </>
          }
        />
      ) : null}
      {canRepairRound ? (
        <StatBar
          actions={
            <RepairRoundButton slug={slug} round={view.round} />
          }
        />
      ) : null}
    </>
  ) : null;

  return (
    <>
      <AdminPageHead
        title={
          <span className="admin-page-title">
            <span className="admin-page-title__eyebrow">{eyebrow}</span>
            {tournament.name}
          </span>
        }
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
          action={
            <StartBracketForm
              slug={slug}
              participants={await listParticipants(slug)}
              seedable={tournament.structure !== "swiss"}
            />
          }
        />
      ) : tournament.structure === "swiss" ? (
        <>
          {bracketActions}
          <SwissBracketView
            slug={slug}
            view={view}
            placings={placings}
            topCut={tournament.topCut}
            tab={selectedTab}
            round={selectedRound}
          />
        </>
      ) : (
        <BracketRounds slug={slug} view={view} placings={placings} actions={bracketActions} />
      )}
    </>
  );
}
