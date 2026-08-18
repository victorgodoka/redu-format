import { parseRichText } from "@/lib/rich-text";
import type { TournamentEvent } from "@/lib/events";

/** Renders event.description through parseRichText - plain JSX runs, never dangerouslySetInnerHTML. */
export default function EventDescription({ event }: { event: TournamentEvent }) {
  if (!event.description) return null;
  const paragraphs = parseRichText(event.description);
  if (paragraphs.length === 0) return null;

  return (
    <div className="prose">
      {paragraphs.map((runs, pi) => (
        <p key={pi}>
          {runs.map((run, ri) => {
            if ("break" in run) return <br key={ri} />;
            if (run.bold) return <strong key={ri}>{run.text}</strong>;
            if (run.italic) return <em key={ri}>{run.text}</em>;
            return run.text;
          })}
        </p>
      ))}
    </div>
  );
}
