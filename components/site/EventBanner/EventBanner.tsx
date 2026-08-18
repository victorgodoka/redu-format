import type { TournamentEvent } from "@/lib/events";

/**
 * Uploaded bytes served from our own /events/[slug]/banner route, not a
 * curated CDN asset (unlike card/avatar art), so a plain <img> is used
 * instead of next/image.
 */
export default function EventBanner({ event }: { event: TournamentEvent }) {
  if (!event.hasBanner) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="event-banner" src={`/events/${event.slug}/banner`} alt={event.name} />;
}
