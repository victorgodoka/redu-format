"use client"
import type { TournamentEvent } from "@/lib/events";
import Notice from "@/components/ui/Notice";
import showdown from "showdown"
import DOMPurify from 'dompurify';

/** Renders event.description through parseRichText - plain JSX runs, never dangerouslySetInnerHTML. */
export default function EventDescription({ event }: { event: TournamentEvent }) {
  if (!event.description) return null;
  const converter = new showdown.Converter()
  const rawHtml = converter.makeHtml(event.description);
  const cleanHtml = DOMPurify.sanitize(rawHtml);

  return (
    <Notice variant="done">
      <div className="event__description" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </Notice>
  );
}
