import Link from "next/link";
import Panel from "@/components/ui/Panel";
import { formatDate, STRUCTURES, type TournamentEvent } from "@/lib/events";

/**
 * `.featured*` CSS stays global (globals.css) - shared with admin's StatBar
 * and the public dashboard's stats row, not owned by this component alone.
 */
export default function FeaturedEventCard({
  event,
  winnerName,
}: {
  event: TournamentEvent;
  winnerName: string | null;
}) {
  return (
    <Panel className="featured">
      <span className="featured__badge">Hall of Fame</span>
      <div className="featured__body">
        <div className="featured__main">
          <h2 className="featured__name">
            <Link href={`/events/${event.slug}`}>{event.name}</Link>
          </h2>
          <p className="featured__date">{formatDate(event.finishedAt ?? event.startsAt)}</p>
        </div>
        <dl className="featured__stats">
          <div>
            <dt>Winner</dt>
            <dd>{winnerName ?? "—"}</dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd>{event.taken.toLocaleString("en-GB")}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{STRUCTURES[event.structure].label}</dd>
          </div>
          <div>
            <dt>Host</dt>
            <dd>{event.host}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}
