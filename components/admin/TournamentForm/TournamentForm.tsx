"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import FormGroup from "@/components/ui/FormGroup";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import {
  ENGINES,
  recommendedTopCut,
  SEAT_OPTIONS,
  STRUCTURES,
  type Engine,
  type Structure,
} from "@/lib/events";
import type { TournamentEvent } from "@/lib/tournaments";
import type { TournamentFormState } from "@/app/admin/(protected)/tournaments/actions";

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
// TEMPORARY WE WILL SUPPORT ONLY YHE PINNED_CURRENCIES
function fullCurrencyOptions(): string[] {
  return PINNED_CURRENCIES;
}

/** The actual glyph for a currency (R$, $, €, ...), read off Intl instead of hand-mapped. */
function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat("en-US", { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency;
}

/**
 * IANA zone names, same SSR-safe pattern as fullCurrencyOptions above. The
 * server-snapshot fallback must be this exact same array reference every
 * call - a fresh `["UTC"]` literal each render is what threw "getServerSnapshot
 * should be cached" below.
 */
const UTC_ONLY = ["UTC"];

let cachedTimeZoneOptions: string[] | null = null;
function timeZoneOptions(): string[] {
  if (!cachedTimeZoneOptions) {
    cachedTimeZoneOptions =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : UTC_ONLY;
  }
  return cachedTimeZoneOptions;
}

function detectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Keeps only digits, for the calculator-style amount mask below. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Cents (as typed digits) to a "12.34" decimal string. */
function centsToAmount(cents: string): string {
  return cents ? (Number(cents) / 100).toFixed(2) : "";
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
  defaultHost,
  isEditing,
}: {
  action: (
    state: TournamentFormState,
    form: FormData,
  ) => Promise<TournamentFormState>;
  tournament?: TournamentEvent;
  /** Display name (fallback username) of the admin creating a new tournament - unused when editing, since the field already has a real value. */
  defaultHost?: string;
  isEditing?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  const [structure, setStructure] = useState<Structure>(
    tournament?.structure ?? "swiss",
  );
  const [seats, setSeats] = useState(
    tournament
      ? tournament.seats === null
        ? "unlimited"
        : String(tournament.seats)
      : "64",
  );
  const [hasTopCut, setHasTopCut] = useState(
    tournament ? tournament.topCut !== null : false,
  );
  const [entryType, setEntryType] = useState<"free" | "paid">(
    tournament?.entry.type ?? "free",
  );
  const [currency, setCurrency] = useState(
    tournament?.entry.type === "paid" ? tournament.entry.currency : "USD",
  );
  const [amountCents, setAmountCents] = useState(() =>
    tournament?.entry.type === "paid"
      ? String(Math.round(tournament.entry.amount * 100))
      : "",
  );
  const amountValue = centsToAmount(amountCents);

  const currencyOptions = useSyncExternalStore(
    subscribeNever,
    fullCurrencyOptions,
    () => PINNED_CURRENCIES,
  );
  const timezoneOptions = useSyncExternalStore(
    subscribeNever,
    timeZoneOptions,
    () => UTC_ONLY,
  );

  // "UTC" for a stable server/first-paint snapshot, the browser's real zone
  // once the client snapshot is available - same useSyncExternalStore
  // pattern as the currency and timezone option lists above, so this needs
  // no effect (and can't desync from what those lists resolve to).
  const detectedTimezone = useSyncExternalStore(
    subscribeNever,
    detectedTimeZone,
    () => "UTC",
  );
  const [manualTimezone, setManualTimezone] = useState<string | null>(null);
  const timezone = manualTimezone ?? detectedTimezone;

  const seatsNumber = seats === "unlimited" ? null : Number(seats);
  const showTopCut =
    structure === "swiss" && (seatsNumber === null || seatsNumber > 8);
  const topCutSize =
    seatsNumber !== null ? recommendedTopCut(seatsNumber) : null;

  return (
    <form action={formAction} className="form form--grid">
      {isEditing && tournament ? (
        <input type="hidden" name="slug" value={tournament.slug} />
      ) : null}

      <FormField label="Name" htmlFor="name" full>
        <Input id="name" name="name" type="text" defaultValue={tournament?.name} required />
      </FormField>

      <FormField label="Starts on" htmlFor="startsAtDate">
        <Input
          id="startsAtDate"
          name="startsAtDate"
          type="date"
          defaultValue={tournament ? toLocalDate(tournament.startsAt) : undefined}
          required
        />
      </FormField>

      <FormGroup>
        <FormField label="Starts at" htmlFor="startsAtTime">
          <Input
            id="startsAtTime"
            name="startsAtTime"
            type="time"
            defaultValue={tournament ? toLocalTime(tournament.startsAt) : undefined}
            required
          />
        </FormField>

        <FormField label="Timezone" htmlFor="timezone">
          <Select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => setManualTimezone(e.target.value)}
          >
            {timezoneOptions.includes(timezone) ? null : (
              <option value={timezone}>{timezone}</option>
            )}
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </FormField>
      </FormGroup>

      <div className="form__field">
        <label htmlFor="structure">Structure</label>
        <Select
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
        </Select>
        {showTopCut ? (
          <div className="form__field">
            <Label className="topcut__toggle">
              <input
                type="checkbox"
                name="hasTopCut"
                checked={hasTopCut}
                onChange={(e) => setHasTopCut(e.target.checked)}
              />
              <span>This tournament cuts to a bracket after Swiss</span>
              {hasTopCut ? (
                <p className="form__hint">
                  {seatsNumber === null
                    ? "Unlimited seats: the top cut will be calculated from the number of valid signups once the tournament starts."
                    : topCutSize
                      ? `(Top ${topCutSize})`
                      : ""}
                </p>
              ) : null}
            </Label>
          </div>
        ) : null}
      </div>

      <FormField label="Seats" htmlFor="seats">
        <Select id="seats" name="seats" value={seats} onChange={(e) => setSeats(e.target.value)}>
          <option value="unlimited">Unlimited</option>
          {SEAT_OPTIONS.map((n) => (
            <option disabled={(tournament?.taken || 0) > n} key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Rounds" htmlFor="rounds">
        <Input
          id="rounds"
          name="rounds"
          type="number"
          min={1}
          defaultValue={tournament?.rounds ?? 5}
          required
        />
      </FormField>

      <FormField label="Match format" htmlFor="matchFormat">
        {isEditing && tournament ? (
          <Input
            id="matchFormat"
            name="matchFormat"
            defaultValue={tournament.matchFormat}
            readOnly
            required
          />
        ) : (
          <Select id="matchFormat" name="matchFormat" defaultValue={tournament?.matchFormat ?? "Bo3"}>
            {MATCH_FORMATS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Engine" htmlFor="engine">
        <Select id="engine" name="engine" defaultValue={tournament?.engine ?? "dueling-nexus"}>
          {(Object.keys(ENGINES) as Engine[]).map((value) => (
            <option key={value} value={value}>
              {ENGINES[value].label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Round deadline (days)" htmlFor="roundLimitDays">
        <Input
          id="roundLimitDays"
          name="roundLimitDays"
          type="number"
          min={1}
          defaultValue={tournament?.roundLimitDays ?? 2}
          required
        />
      </FormField>

      <FormField label="Entry" htmlFor="entryType">
        {isEditing && tournament ? (
          <Input id="entryType" name="entryType" readOnly defaultValue={tournament.entry.type} required />
        ) : (
          <Select
            id="entryType"
            name="entryType"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as "free" | "paid")}
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </Select>
        )}
      </FormField>

      {entryType === "paid" ? (
        <FormGroup>
          <div className="form__field">
            <label htmlFor="entryAmount">Amount</label>
            <div className="input-affix">
              <span className="input-affix__symbol">{currencySymbol(currency)}</span>
              <Input
                id="entryAmount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountValue}
                onChange={(e) => setAmountCents(digitsOnly(e.target.value))}
                placeholder="0.00"
                required
                readOnly={isEditing}
              />
            </div>
            <input type="hidden" name="entryAmount" value={amountValue} />
          </div>

          {!isEditing ? (
            <FormField label="Currency" htmlFor="entryCurrency">
              <Select
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
              </Select>
            </FormField>
          ) : (
            <input type="hidden" name="entryCurrency" value={currency} />
          )}
        </FormGroup>
      ) : null}

      {isEditing && tournament ? (
        <FormField label="Seats taken" htmlFor="seatsTaken">
          <Input id="seatsTaken" name="seatsTaken" type="number" disabled defaultValue={tournament.taken} />
        </FormField>
      ) : null}

      <FormField label="Host" htmlFor="host">
        <Input
          id="host"
          name="host"
          type="text"
          defaultValue={tournament?.host ?? defaultHost}
          readOnly={isEditing}
          placeholder="Dueling Nexus"
        />
      </FormField>

      <FormField label="Signup URL" htmlFor="signupUrl">
        <Input
          id="signupUrl"
          name="signupUrl"
          type="text"
          defaultValue={tournament?.signupUrl}
          placeholder="Defaults to the tournament name, slugified"
        />
      </FormField>

      {state.error ? (
        <p role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}

      <Button
        variant="solid"
        type="submit"
        pending={pending}
        pendingLabel={isEditing ? "Saving..." : "Creating..."}
      >
        {isEditing ? "Save changes" : "Create tournament"}
      </Button>
    </form>
  );
}
