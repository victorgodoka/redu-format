import Link from "next/link";
import {
  ALMOST_FULL,
  fillRatio,
  formatDate,
  formatEntry,
  formatTime,
  isFinished,
  isPast,
  seatsLeft,
  STRUCTURES,
  type TournamentEvent,
} from "@/lib/events";
import styles from "./EventList.module.css";

type FormAction = (formData: FormData) => void | Promise<void>;

function EventCard({
  event,
  now,
  isRegistered,
  isSaved,
  hasSession,
  saveAction,
  unsaveAction,
}: {
  event: TournamentEvent;
  now: Date;
  isRegistered: boolean;
  isSaved: boolean;
  hasSession: boolean;
  saveAction: FormAction;
  unsaveAction: FormAction;
}) {
  const left = seatsLeft(event);
  const full = left === 0;
  const past = isPast(event, now);
  const finished = isFinished(event);
  const almost = !full && fillRatio(event) >= ALMOST_FULL;

  return (
    <li className={`${styles.event} panel${past ? ` ${styles.past}` : ""}`}>
      <div className={styles.when}>
        <span className={styles.date}>{formatDate(event.startsAt)}</span>
        <span className={styles.time}>{formatTime(event.startsAt)}</span>
        {finished ? (
          <span className={styles.done}>Finished</span>
        ) : past ? (
          <span className={styles.done}>In progress</span>
        ) : null}
      </div>

      <div>
        <h2 className={styles.name}>
          <Link href={`/events/${event.slug}`}>{event.name}</Link>
        </h2>
        <p className={styles.meta}>
          <span className={styles.tag}>{STRUCTURES[event.structure].label}</span>
          {event.structure === "double-elim" ? null : <span>{event.rounds} rounds</span>}
          {event.topCut ? <span>Top {event.topCut}</span> : null}
          <span>{event.matchFormat}</span>
          <span>
            {event.roundLimitDays}-day {event.structure === "double-elim" ? "deadline" : "round deadline"}
          </span>
        </p>
        <p className={styles.host}>
          {event.host} · {formatEntry(event.entry)}
        </p>
      </div>

      <div className={styles.signup}>
        {/* Once registration is closed there's an attendance, not seats left. */}
        {past ? (
          <span className={styles.seats}>
            {event.seats === null
              ? `${event.taken} duelists`
              : `${event.taken} of ${event.seats} duelists`}
          </span>
        ) : (
          <span
            className={`${styles.seats}${full ? ` ${styles.seatsFull}` : almost ? ` ${styles.seatsAlmost}` : ""}`}
          >
            {event.seats === null
              ? "Unlimited seats"
              : full
                ? "Sold out"
                : `${left} of ${event.seats} seats left`}
          </span>
        )}

        {finished ? (
          <Link className="btn btn--quiet" href={`/events/${event.slug}`}>
            Results
          </Link>
        ) : isRegistered ? (
          <Link className="btn btn--in" href={`/events/${event.slug}/signup`}>
            You are in
          </Link>
        ) : past ? (
          <span className="btn btn--quiet" aria-disabled="true">
            Registration closed
          </span>
        ) : full ? (
          <span className="btn btn--quiet" aria-disabled="true">
            Sold out
          </span>
        ) : (
          <Link className="btn btn--solid" href={`/events/${event.slug}/signup`}>
            Sign up
          </Link>
        )}

        {hasSession ? (
          <form action={isSaved ? unsaveAction : saveAction}>
            <input type="hidden" name="slug" value={event.slug} />
            <button className={`btn btn--quiet${isSaved ? " btn--in" : ""}`} type="submit">
              {isSaved ? "Saved" : "Save"}
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

export default function EventList({
  events,
  now,
  hasSession,
  registered,
  saved,
  saveAction,
  unsaveAction,
}: {
  events: TournamentEvent[];
  now: Date;
  hasSession: boolean;
  registered: Set<string>;
  saved: Set<string>;
  saveAction: FormAction;
  unsaveAction: FormAction;
}) {
  return (
    <ul className={styles.events}>
      {events.map((event) => (
        <EventCard
          key={event.slug}
          event={event}
          now={now}
          isRegistered={registered.has(event.slug)}
          isSaved={saved.has(event.slug)}
          hasSession={hasSession}
          saveAction={saveAction}
          unsaveAction={unsaveAction}
        />
      ))}
    </ul>
  );
}
