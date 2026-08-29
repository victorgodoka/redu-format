import Link from "next/link";
import Countdown from "@/components/site/Countdown";
import Button from "@/components/ui/Button";
import Lede from "@/components/ui/Lede";
import Notice from "@/components/ui/Notice";
import Tab from "@/components/ui/Tab";
import type { MyMatchView, MyRoundView } from "@/lib/backend/services/results.service";
import type { RedoStatus } from "@/lib/backend/services/redo.service";
import { formatDate, formatTime } from "@/lib/events";
import { TO_DISCORD_URL } from "@/lib/site";
import {
  acceptRedoAction,
  contestResultAction,
  dismissNoShowAction,
  rejectRedoAction,
  reportNoShowAction,
  requestRedoAction,
  submitMatchReportAction,
} from "@/app/events/[slug]/report-actions";
import { NEXUS_LOBBY_URL } from "@/lib/nexus-parse";

function at(iso: string): string {
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

function verb(result: "win" | "loss" | "draw" | "bye"): string {
  return result === "win" ? "won" : result === "loss" ? "lost" : result === "draw" ? "drew" : "had a bye";
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
 * The score buttons. One report settles the duel, so each button is a
 * complete statement: who won and how the games went. A Bo1 has only one
 * possible score, so it collapses back to plain won/lost.
 */
function ReportForm({ slug, match }: { slug: string; match: MyMatchView }) {
  const needed = match.winningGames;
  // A Bo3 can end 2-0 or 2-1; a Bo1 has exactly one possible score, so it
  // collapses back to plain won/lost. Each button carries the whole call as
  // one value ("win:2:1") - a button cannot contain form fields of its own.
  const scores = needed > 1 ? [[needed, 0], [needed, needed - 1]] : [[1, 0]];

  return (
    <form action={submitMatchReportAction} className="admin-row__actions">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="matchId" value={match.matchId} />
      {scores.map(([w, l]) => (
        <Button key={`win-${w}-${l}`} variant="solid" type="submit" name="score" value={`win:${w}:${l}`}>
          {needed > 1 ? `I won ${w}-${l}` : "I won"}
        </Button>
      ))}
      {scores.map(([w, l]) => (
        <Button key={`loss-${w}-${l}`} type="submit" name="score" value={`loss:${w}:${l}`}>
          {needed > 1 ? `I lost ${l}-${w}` : "I lost"}
        </Button>
      ))}
    </form>
  );
}

/** The button that opens a no-show call - lives inside the match card, since it is an action on the duel. */
function NoShowButton({ slug, match }: { slug: string; match: MyMatchView }) {
  // Whether the button is available yet was decided server-side (the match's
  // own activeSince), so no clock in the browser gets a say in it.
  if (match.noShow || !match.canReportNoShow) return null;

  return (
    <form action={reportNoShowAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="matchId" value={match.matchId} />
      <Button variant="quiet" type="submit">
        Report opponent as no-show
      </Button>
    </form>
  );
}

/** An open no-show call, its countdown, and the way out of it for whoever was accused. */
function NoShowNotice({ slug, match }: { slug: string; match: MyMatchView }) {
  const flag = match.noShow;
  if (!flag) return null;

  return (
      <Notice variant="warn">
        <Tab>No-show reported</Tab>
        {flag.againstMe ? (
          <>
            <h2 className="notice__title">Your opponent says you are not there</h2>
            <Lede>
              {flag.autoResolvesAt ? (
                <>
                  If nothing changes, this match is awarded to them in{" "}
                  <Countdown to={flag.autoResolvesAt} fallback={at(flag.autoResolvesAt)} urgentUnder={120} />. Report
                  your result, or dismiss the call if you are here.
                </>
              ) : (
                "A Tournament Organizer will look at it. Report your result, or dismiss the call if you are here."
              )}
            </Lede>
            <Lede>Two no-shows that stand means disqualification.</Lede>
          </>
        ) : (
          <>
            <h2 className="notice__title">You reported your opponent as a no-show</h2>
            <Lede>
              {flag.autoResolvesAt ? (
                <>
                  The match goes to you in{" "}
                  <Countdown to={flag.autoResolvesAt} fallback={at(flag.autoResolvesAt)} urgentUnder={120} /> unless it
                  is dismissed. Moderators have been alerted.
                </>
              ) : (
                "Moderators have been alerted and will resolve it - a multi-day tournament never decides this on its own."
              )}
            </Lede>
          </>
        )}
      <form action={dismissNoShowAction}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="matchId" value={match.matchId} />
        <Button type="submit">Dismiss - we are both here</Button>
      </form>
    </Notice>
  );
}

/**
 * A duel Dueling Nexus reported as a connection loss - request-and-consent
 * redo, per redo.service.ts. Shown for whichever side of the flow this
 * player is currently in; the "eligible" state (nobody has asked yet) is the
 * only one either player can act on unprompted.
 */
function RedoCard({ slug, match, redo }: { slug: string; match: MyMatchView; redo: RedoStatus }) {
  if (!redo) return null;

  const hidden = <input type="hidden" name="slug" value={slug} />;
  const matchIdField = <input type="hidden" name="matchId" value={match.matchId} />;

  if (redo.status === "eligible") {
    return (
      <Notice variant="warn">
        <Tab>Disconnected</Tab>
        <h2 className="notice__title">This duel ended in a connection loss</h2>
        <Lede>
          If you both agree it should be replayed, request a redo - your opponent has to accept
          before anything changes. If nobody asks, the result stands as played.
        </Lede>
        <form action={requestRedoAction}>
          {hidden}
          {matchIdField}
          <Button variant="solid" type="submit">
            Request a redo
          </Button>
        </form>
      </Notice>
    );
  }

  if (redo.status === "pending") {
    return (
      <Notice variant="warn">
        <Tab>Redo requested</Tab>
        {redo.requestedByMe ? (
          <>
            <h2 className="notice__title">Waiting on your opponent</h2>
            <Lede>
              {redo.expiresAt ? (
                <>
                  If they do not respond by{" "}
                  <Countdown to={redo.expiresAt} fallback={at(redo.expiresAt)} urgentUnder={120} />, the disconnect
                  stands as played.
                </>
              ) : (
                "Waiting for them to accept or decline."
              )}
            </Lede>
            <form action={rejectRedoAction}>
              {hidden}
              {matchIdField}
              <Button type="submit">Cancel the request</Button>
            </form>
          </>
        ) : (
          <>
            <h2 className="notice__title">Your opponent wants to redo this duel</h2>
            <Lede>
              It disconnected, and they are asking to replay it.{" "}
              {redo.expiresAt ? (
                <>
                  Respond by <Countdown to={redo.expiresAt} fallback={at(redo.expiresAt)} urgentUnder={120} /> or it
                  stands as played.
                </>
              ) : null}
            </Lede>
            <div className="admin-row__actions">
              <form action={acceptRedoAction}>
                {hidden}
                {matchIdField}
                <Button variant="solid" type="submit">
                  Agree to redo it
                </Button>
              </form>
              <form action={rejectRedoAction}>
                {hidden}
                {matchIdField}
                <Button type="submit">No, the result stands</Button>
              </form>
            </div>
          </>
        )}
      </Notice>
    );
  }

  if (redo.status === "accepted") {
    return (
      <Notice variant="done">
        <Tab>Redo accepted</Tab>
        <Lede>Both of you agreed to redo the disconnected duel - a fresh duel room is above.</Lede>
      </Notice>
    );
  }

  return null; // rejected/expired - the disconnect stands, nothing left to act on here.
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
  redo,
  eventName,
  href,
}: {
  slug: string;
  round: MyRoundView;
  /** A disconnected duel's redo state for this round's match, if any - see redo.service.ts's getRedoStatus. */
  redo?: RedoStatus;
  eventName?: string;
  href?: string;
}) {
  const heading = eventName ? `${eventName} · ${round.roundLabel}` : round.roundLabel;
  /**
   * An elimination bracket has no scheduled next round: matches open one at a
   * time as their feeders resolve, so promising a start time would be a lie.
   */
  const bracketFormat =
    round.phase === "winners" || round.phase === "losers" || round.phase === "grandFinal" || round.phase === "topCut";
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
          Odd number of duelists, so you sit this round out with an automatic win - there is no duel
          to play and nothing to report. It counts as a win for {round.roundLabel}, not for the next
          one.
          {!bracketFormat && round.nextRoundAt ? ` The next round starts ${at(round.nextRoundAt)}.` : ""}
        </Lede>
        {link}
      </Notice>
    );
  }

  if (round.state === "waiting") {
    return (
      <Notice>
        <Tab>{heading}</Tab>
        <h2 className="notice__title">
          {round.settled ? "Your duel is settled" : "No duel for you right now"}
        </h2>
        <Lede>
          {round.settled
            ? `You ${verb(round.settled.result)} ${round.settled.score}${
                round.settled.opponentName ? ` vs ${round.settled.opponentName}` : ""
              } in ${round.roundLabel}.`
            : "You are still in the tournament, but you are not paired right now."}{" "}
          {bracketFormat
            ? "Your next opponent is whoever wins their own match, so this fills in as the bracket resolves."
            : "Waiting on the other tables before the round turns over."}
          {!bracketFormat && round.nextRoundAt ? ` Next round starts ${at(round.nextRoundAt)}.` : ""}
        </Lede>
        {link}
      </Notice>
    );
  }

  if (round.state === "out") {
    return (
      <Notice variant="warn">
        <Tab>{heading}</Tab>
        <h2 className="notice__title">
          {bracketFormat ? "You are out of the bracket" : "You are out of this tournament"}
        </h2>
        <ContactTO>
          {bracketFormat
            ? "You lost your last life in the bracket, dropped, or were removed. Your played duels still count for everyone else's tiebreakers."
            : "You dropped, or were removed after missing rounds. Your played duels still count for everyone else's tiebreakers."}{" "}
          If this looks wrong, message a Tournament Organizer.
        </ContactTO>
        {link}
      </Notice>
    );
  }

  const match = round.match;
  if (!match) return null;

  return (
    <>
      <Notice variant={match.phase === "topCut" || match.phase === "grandFinal" ? "done" : undefined}>
        <Tab>{heading} · Your duel</Tab>
        <h2 className="notice__title">vs {match.opponentName ?? "TBD"}</h2>
        {match.phase === "topCut" ? (
          <Lede>You made Top Cut - this is single elimination from here, no more Swiss cushion.</Lede>
        ) : match.phase === "losers" ? (
          <Lede>You are in the losers bracket - one more loss and you are out.</Lede>
        ) : match.phase === "grandFinal" ? (
          <Lede>Grand Final. Win this and the tournament is yours.</Lede>
        ) : null}

        {match.deadlineAt ? (
          <Lede>
            {match.locked ? (
              <>Closed {at(match.deadlineAt)}.</>
            ) : (
              <>
                Time left to report:{" "}
                <Countdown to={match.deadlineAt} fallback={at(match.deadlineAt)} />
              </>
            )}
          </Lede>
        ) : null}

        {match.roomHash ? (
          <a
            className="btn btn--solid"
            href={`${NEXUS_LOBBY_URL}/NA-${match.roomHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the duel room
          </a>
        ) : null}

        {match.reportedScore ? (
          <>
            <Lede>
              {match.reportedByOpponent
                ? `Your opponent reported this duel: ${match.reportedScore}. You do not need to confirm it.`
                : `You reported ${match.myReport === "win" ? "a win" : "a loss"}, ${match.reportedScore}.`}
            </Lede>
            {match.reportedByOpponent && !match.contested ? (
              <form action={contestResultAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="matchId" value={match.matchId} />
                <Button variant="quiet" type="submit">
                  That is not what happened - tell a moderator
                </Button>
              </form>
            ) : null}
            {match.contested ? (
              <Lede>A moderator has been asked to review this result.</Lede>
            ) : null}
          </>
        ) : match.locked ? null : (
          <>
            <Lede>Report the result as soon as the series is over - one report settles it.</Lede>
            <ReportForm slug={slug} match={match} />
          </>
        )}

        {match.locked ? null : <NoShowButton slug={slug} match={match} />}
        {link}
      </Notice>

      {match.locked ? null : <NoShowNotice slug={slug} match={match} />}
      <RedoCard slug={slug} match={match} redo={redo ?? null} />
      {match.locked ? <Locked nextRoundAt={match.nextRoundAt} /> : null}
    </>
  );
}
