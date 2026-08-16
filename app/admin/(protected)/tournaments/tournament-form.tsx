"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import {
  ENGINES,
  recommendedTopCut,
  SEAT_OPTIONS,
  STRUCTURES,
  type Engine,
  type Structure,
} from "@/lib/events";
import type { TournamentEvent } from "@/lib/tournaments";
import type { TournamentFormState } from "./actions";

const MATCH_FORMATS = ["Bo1", "Bo3"] as const;

const PINNED_CURRENCIES = ["USD", "EUR", "BRL"];

/**
 * Intl.supportedValuesOf('currency') is not guaranteed to match between the
 * server's Node/ICU build and the browser's, so it can only be read on the
 * client. useSyncExternalStore (same pattern as useCompact in card-browser.tsx)
 * gives the pinned-only list as the SSR/first-paint snapshot and the full list
 * once the client snapshot is available, without a hydration mismatch.
 */
function subscribeNever() {
  return () => {};
}

// getSnapshot must return a referentially stable value when nothing changed,
// or useSyncExternalStore re-renders forever; the list never changes at
// runtime, so computing it once and caching the same array is correct.
let cachedCurrencyOptions: string[] | null = null;
function fullCurrencyOptions(): string[] {
  if (!cachedCurrencyOptions) {
    cachedCurrencyOptions =
      typeof Intl.supportedValuesOf === "function"
        ? [
            ...PINNED_CURRENCIES,
            ...Intl.supportedValuesOf("currency").filter((c) => !PINNED_CURRENCIES.includes(c)),
          ]
        : PINNED_CURRENCIES;
  }
  return cachedCurrencyOptions;
}

/** The actual glyph for a currency (R$, $, €, ...), read off Intl instead of hand-mapped. */
function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat("en-US", { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency;
}

/** "2026-08-12" for a date input, from a UTC ISO string. */
function toLocalDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "23:00" for a time input, from a UTC ISO string. */
function toLocalTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const initial: TournamentFormState = {};

export default function TournamentForm({
  action,
  tournament,
}: {
  action: (state: TournamentFormState, form: FormData) => Promise<TournamentFormState>;
  tournament?: TournamentEvent;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  const [structure, setStructure] = useState<Structure>(tournament?.structure ?? "swiss");
  const [seats, setSeats] = useState(
    tournament ? (tournament.seats === null ? "unlimited" : String(tournament.seats)) : "64",
  );
  const [hasTopCut, setHasTopCut] = useState(tournament ? tournament.topCut !== null : false);
  const [entryType, setEntryType] = useState<"free" | "paid">(tournament?.entry.type ?? "free");
  const [currency, setCurrency] = useState(
    tournament?.entry.type === "paid" ? tournament.entry.currency : "USD",
  );

  const currencyOptions = useSyncExternalStore(
    subscribeNever,
    fullCurrencyOptions,
    () => PINNED_CURRENCIES,
  );

  const seatsNumber = seats === "unlimited" ? null : Number(seats);
  const showTopCut = structure === "swiss" && (seatsNumber === null || seatsNumber > 8);
  const topCutSize = seatsNumber !== null ? recommendedTopCut(seatsNumber) : null;

  return (
    <form action={formAction} className="form form--grid">
      {tournament ? <input type="hidden" name="slug" value={tournament.slug} /> : null}

      <div className="form__field form__field--full">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" defaultValue={tournament?.name} required />
      </div>

      <div className="form__field">
        <label htmlFor="startsAtDate">Starts on</label>
        <input
          id="startsAtDate"
          name="startsAtDate"
          type="date"
          defaultValue={tournament ? toLocalDate(tournament.startsAt) : undefined}
          required
        />
      </div>

      <div className="form__field">
        <label htmlFor="startsAtTime">Starts at</label>
        <input
          id="startsAtTime"
          name="startsAtTime"
          type="time"
          defaultValue={tournament ? toLocalTime(tournament.startsAt) : undefined}
          required
        />
      </div>

      <div className="form__field">
        <label htmlFor="structure">Structure</label>
        <select
          id="structure"
          name="structure"
          value={structure}
          onChange={(e) => setStructure(e.target.value as Structure)}
        >
          {(Object.keys(STRUCTURES) as Structure[]).map((value) => (
            <option key={value} value={value}>
              {STRUCTURES[value].label}
            </option>
          ))}
        </select>
      </div>

      <div className="form__field">
        <label htmlFor="seats">Seats</label>
        <select
          id="seats"
          name="seats"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        >
          <option value="unlimited">Unlimited</option>
          {SEAT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="form__field">
        <label htmlFor="rounds">Rounds</label>
        <input id="rounds" name="rounds" type="number" min={1} defaultValue={tournament?.rounds ?? 5} required />
      </div>

      {showTopCut ? (
        <div className="form__field form__field--full">
          <label>Top cut</label>
          <label className="topcut__toggle">
            <input
              type="checkbox"
              name="hasTopCut"
              checked={hasTopCut}
              onChange={(e) => setHasTopCut(e.target.checked)}
            />
            This tournament cuts to a bracket after Swiss
          </label>
          {hasTopCut ? (
            <p className="form__hint">
              {seatsNumber === null
                ? "Unlimited seats: the top cut will be calculated from the number of valid signups once the tournament starts."
                : topCutSize
                  ? `Top ${topCutSize}, based on ${seatsNumber} seats.`
                  : "No top cut at this seat count."}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="form__field">
        <label htmlFor="matchFormat">Match format</label>
        <select id="matchFormat" name="matchFormat" defaultValue={tournament?.matchFormat ?? "Bo3"}>
          {MATCH_FORMATS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="form__field">
        <label htmlFor="engine">Engine</label>
        <select id="engine" name="engine" defaultValue={tournament?.engine ?? "dueling-nexus"}>
          {(Object.keys(ENGINES) as Engine[]).map((value) => (
            <option key={value} value={value}>
              {ENGINES[value].label}
            </option>
          ))}
        </select>
      </div>

      <div className="form__field">
        <label htmlFor="roundLimitDays">Round deadline (days)</label>
        <input
          id="roundLimitDays"
          name="roundLimitDays"
          type="number"
          min={1}
          defaultValue={tournament?.roundLimitDays ?? 2}
          required
        />
        <p className="form__hint">
          How long a round stays open for players to duel before it&apos;s force-closed and
          anyone missing a result auto-loses.
        </p>
      </div>

      {tournament ? (
        <div className="form__field">
          <label>Seats taken</label>
          <p className="form__hint">
            {tournament.taken} - counted from real registrations, not editable here
          </p>
        </div>
      ) : null}

      <div className="form__field">
        <label htmlFor="entryType">Entry</label>
        <select
          id="entryType"
          name="entryType"
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as "free" | "paid")}
        >
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {entryType === "paid" ? (
        <>
          <div className="form__field">
            <label htmlFor="entryAmount">Amount</label>
            <div className="input-affix">
              <span className="input-affix__symbol">{currencySymbol(currency)}</span>
              <input
                id="entryAmount"
                name="entryAmount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={
                  tournament?.entry.type === "paid" ? tournament.entry.amount : undefined
                }
                required
              />
            </div>
          </div>

          <div className="form__field">
            <label htmlFor="entryCurrency">Currency</label>
            <select
              id="entryCurrency"
              name="entryCurrency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div className="form__field">
        <label htmlFor="host">Host</label>
        <input
          id="host"
          name="host"
          type="text"
          defaultValue={tournament?.host}
          placeholder="Dueling Nexus"
        />
      </div>

      <div className="form__field">
        <label htmlFor="signupUrl">Signup URL</label>
        <input
          id="signupUrl"
          name="signupUrl"
          type="text"
          defaultValue={tournament?.signupUrl}
          placeholder="Defaults to the tournament name, slugified"
        />
      </div>

      {state.error ? (
        <p role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}

      <button className="btn btn--solid" type="submit" disabled={pending}>
        {pending ? "Saving..." : tournament ? "Save changes" : "Create tournament"}
      </button>
    </form>
  );
}
