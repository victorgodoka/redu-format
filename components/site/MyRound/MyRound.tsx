import Link from "next/link";
import Button from "@/components/ui/Button";
import Lede from "@/components/ui/Lede";
import Notice from "@/components/ui/Notice";
import Tab from "@/components/ui/Tab";
import type { MyRoundView } from "@/lib/backend/services/results.service";
import { formatDate, formatTime } from "@/lib/events";
import { TO_DISCORD_URL } from "@/lib/site";
import { submitMatchReportAction } from "@/app/events/[slug]/report-actions";

function at(iso: string): string {
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

function ContactTO({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Lede>{children}</Lede>
      <a className="btn btn--solid" href={TO_DISCORD_URL} target="_blank" rel="noopener noreferrer">
        Contact a Tournament Organizer
      </a>
    </>
  );
}

/**
 * Why the report buttons are gone. Never a disabled button with no
 * explanation: the round closed, and this says so and where to go if that
 * looks wrong. The backend refuses a late report either way (see
 * submitMatchReport) - this is the human half of the same rule.
 */
function Locked({ nextRoundAt }: { nextRoundAt: string | null }) {
  return (
    <Notice variant="warn">
      <Tab>Reporting closed</Tab>
      <Lede>
        This round is locked - its timer ran out, so results can no longer be submitted or changed
        for it.
        {nextRoundAt ? ` The next round starts ${at(nextRoundAt)}.` : " A Tournament Organizer will start the next round."}
      </Lede>
      <ContactTO>
        Think this is wrong - your duel finished in time, or the result on file is not what
        happened? Message a Tournament Organizer in a tournament channel on our Discord.
      </ContactTO>
    </Notice>
  );
}

/**
 * The player's current round in one card - the duel to report, a bye, a
 * between-rounds wait, or being out - rendered identically on the tournament
 * page and on the dashboard, so reporting is never something you have to go
 * hunting for.
 *
 * `eventName`/`href` are for the dashboard, where several tournaments stack up
 * and each card has to say which one it belongs to.
 */
export default function MyRound({
  slug,
  round,
  eventName,
  href,
}: {
  slug: string;
  round: MyRoundView;
  eventName?: string;
  href?: string;
}) {
  const heading = eventName ? `${eventName} · ${round.roundLabel}` : round.roundLabel;
  const link = href ? (
    <Link className="btn" href={href}>
      Open tournament
    </Link>
  ) : null;

  if (round.state === "bye") {
    return (
      <Notice variant="done">
        <Tab>{heading} · Bye</Tab>
        <h2 className="notice__title">You have a bye this round</h2>
        <Lede>
          Odd number of duelists, so you sit this one out with an automatic win - there is no duel
          to play and nothing to report.
          {round.nextRoundAt ? ` The next round starts ${at(round.nextRoundAt)}.` : ""}
        </Lede>
        {link}
      </Notice>
    );
  }

  if (round.state === "waiting") {
    return (
      <Notice>
        <Tab>{heading}</Tab>
        <h2 className="notice__title">No duel for you right now</h2>
        <Lede>
          You are still in the tournament, but you are not paired in this round - either your duel
          is already settled and the round hasn&apos;t turned over yet, or the next pairing is still
          to come. Nothing to do but wait; your next duel appears here the moment it is paired.
          {round.nextRoundAt ? ` Next round starts ${at(round.nextRoundAt)}.` : ""}
        </Lede>
        {link}
      </Notice>
    );
  }

  if (round.state === "out") {
    return (
      <Notice variant="warn">
        <Tab>{heading}</Tab>
        <h2 className="notice__title">You are out of this tournament</h2>
        <ContactTO>
          You dropped, or were removed after missing rounds. Your played duels still count for
          everyone else&apos;s tiebreakers. If this looks wrong, message a Tournament Organizer.
        </ContactTO>
        {link}
      </Notice>
    );
  }

  const match = round.match;
  if (!match) return null;

  return (
    <>
      <Notice variant={match.phase === "topCut" ? "done" : undefined}>
        <Tab>{heading} · Your duel</Tab>
        <h2 className="notice__title">vs {match.opponentName ?? "TBD"}</h2>
        {match.phase === "topCut" ? (
          <Lede>You made Top Cut - this is single elimination from here, no more Swiss cushion.</Lede>
        ) : null}
        {match.deadlineAt ? <Lede>Round closes {at(match.deadlineAt)}.</Lede> : null}
        {match.roomHash ? (
          <a
            className="btn btn--solid"
            href={`https://duelingnexus.com/duel/NA-${match.roomHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the duel room
          </a>
        ) : null}

        {match.disputed ? (
          <Lede>
            You and your opponent reported different results - a staff member will step in to sort
            it out.
          </Lede>
        ) : match.myReport ? (
          <Lede>
            You reported <b>{match.myReport}</b>.{" "}
            {match.opponentReported
              ? "Reconciling with your opponent's report."
              : "Waiting on your opponent to report too."}
          </Lede>
        ) : match.locked ? null : (
          <Lede>Report your result as soon as the duel is over.</Lede>
        )}

        {match.locked ? null : (
          <form action={submitMatchReportAction} className="admin-row__actions">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="matchId" value={match.matchId} />
            <Button variant="solid" type="submit" name="result" value="win">
              I won
            </Button>
            <Button type="submit" name="result" value="loss">
              I lost
            </Button>
            <Button variant="quiet" type="submit" name="result" value="draw">
              Draw
            </Button>
          </form>
        )}
        {link}
      </Notice>

      {match.locked ? <Locked nextRoundAt={match.nextRoundAt} /> : null}
    </>
  );
}
