import Link from "next/link";
import Panel from "@/components/ui/Panel";
import { FEATURED_EVENT, formatDate } from "@/lib/events";

/**
 * `.featured*` CSS stays global (globals.css) - shared with admin's StatBar
 * and the public dashboard's stats row, not owned by this component alone.
 *
 * Always shows the pinned historical highlight (FEATURED_EVENT), not
 * whichever real tournament finished most recently - the Hall of Fame is a
 * fixed spot, not a rotating one.
 */
export default function FeaturedEventCard() {
  return (
    <Panel className="featured">
      <span className="featured__badge">Hall of Fame</span>
      <div className="featured__body">
        <div className="featured__main">
          <h2 className="featured__name">
            <Link href={`/events/${FEATURED_EVENT.slug}`}>{FEATURED_EVENT.name}</Link>
          </h2>
          <p className="featured__date">{formatDate(FEATURED_EVENT.date)}</p>
        </div>
        <dl className="featured__stats">
          <div>
            <dt>Winner</dt>
            <dd>{FEATURED_EVENT.winner}</dd>
          </div>
          <div>
            <dt>Community</dt>
            <dd>{FEATURED_EVENT.community}</dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd>{FEATURED_EVENT.players.toLocaleString("en-GB")}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{FEATURED_EVENT.format}</dd>
          </div>
          <div>
            <dt>Winning deck</dt>
            <dd>{FEATURED_EVENT.winningDeck}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}
