"use client";

import { useActionState } from "react";
import type { TournamentEvent } from "@/lib/tournaments";
import type { TournamentFormState } from "./actions";

const STRUCTURES = [
  { value: "swiss", label: "Swiss" },
  { value: "single-elim", label: "Single Elimination" },
  { value: "mixed", label: "Swiss + Top Cut" },
];

const MATCH_FORMATS = ["Bo1", "Bo3"];

const initial: TournamentFormState = {};

/** "2026-08-12T23:00" for a datetime-local input, from a UTC ISO string. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TournamentForm({
  action,
  tournament,
}: {
  action: (state: TournamentFormState, form: FormData) => Promise<TournamentFormState>;
  tournament?: TournamentEvent;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="form form--grid">
      {tournament ? <input type="hidden" name="slug" value={tournament.slug} /> : null}

      <div className="form__field form__field--full">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" defaultValue={tournament?.name} required />
      </div>

      <div className="form__field">
        <label htmlFor="startsAt">Starts at</label>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          defaultValue={tournament ? toLocalInput(tournament.startsAt) : undefined}
          required
        />
      </div>

      <div className="form__field">
        <label htmlFor="structure">Structure</label>
        <select id="structure" name="structure" defaultValue={tournament?.structure ?? "swiss"}>
          {STRUCTURES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form__field">
        <label htmlFor="rounds">Rounds</label>
        <input id="rounds" name="rounds" type="number" min={1} defaultValue={tournament?.rounds ?? 5} required />
      </div>

      <div className="form__field">
        <label htmlFor="topCut">Top cut (empty = none)</label>
        <input id="topCut" name="topCut" type="number" min={1} defaultValue={tournament?.topCut ?? ""} />
      </div>

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
        <label htmlFor="timeLimit">Time limit (minutes)</label>
        <input
          id="timeLimit"
          name="timeLimit"
          type="number"
          min={1}
          defaultValue={tournament?.timeLimit ?? 40}
          required
        />
      </div>

      <div className="form__field">
        <label htmlFor="seats">Seats</label>
        <input id="seats" name="seats" type="number" min={1} defaultValue={tournament?.seats ?? 64} required />
      </div>

      {tournament ? (
        <div className="form__field">
          <label htmlFor="taken">Seats taken</label>
          <input id="taken" name="taken" type="number" min={0} defaultValue={tournament.taken} required />
        </div>
      ) : null}

      <div className="form__field form__field--full">
        <label htmlFor="entry">Entry</label>
        <input
          id="entry"
          name="entry"
          type="text"
          defaultValue={tournament?.entry}
          placeholder="Free entry"
          required
        />
      </div>

      <div className="form__field">
        <label htmlFor="host">Host</label>
        <input id="host" name="host" type="text" defaultValue={tournament?.host} required />
      </div>

      <div className="form__field">
        <label htmlFor="signupUrl">Signup URL</label>
        <input id="signupUrl" name="signupUrl" type="text" defaultValue={tournament?.signupUrl ?? "#"} />
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
