import type { TournamentEvent } from "@/lib/events";
import Markdown from "@/components/ui/Markdown";
import Notice from "@/components/ui/Notice";

/** Renders event.description as sanitised markdown - see components/ui/Markdown. */
export default function EventDescription({ event }: { event: TournamentEvent }) {
  if (!event.description) return null;

  return (
    <Notice variant="done" className="event-description">
      <Markdown className="event__description" source={event.description} />
    </Notice>
  );
}
