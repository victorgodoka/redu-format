import type { TournamentEvent } from "@/lib/events";

/**
 * Admin-provided URL, not a curated CDN asset (unlike card/avatar art), so a
 * plain <img> is used instead of next/image - the domain can't be known
 * ahead of time to add to next.config.ts's remotePatterns allowlist.
 */
export default function EventBanner({ event }: { event: TournamentEvent }) {
  if (!event.bannerUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="event-banner" src={event.bannerUrl} alt={event.name} />;
}
