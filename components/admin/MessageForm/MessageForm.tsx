"use client";

import { useActionState, useState } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Notice from "@/components/ui/Notice";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import type { MessageFormState } from "@/app/admin/(protected)/messages/actions";

type Audience = "all" | "tournament" | "players";

const AUDIENCES: Record<Audience, string> = {
  all: "Every registered player",
  tournament: "Everyone in one tournament",
  players: "Specific players (Nexus ID)",
};

const initial: MessageFormState = {};

export default function MessageForm({
  action,
  tournaments,
  playerNames,
}: {
  action: (state: MessageFormState, form: FormData) => Promise<MessageFormState>;
  tournaments: { slug: string; name: string }[];
  /** Known Nexus names, for the picker's autocomplete. */
  playerNames: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [audience, setAudience] = useState<Audience>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  // The <datalist> below is the whole autocomplete - the browser does the
  // matching, so there is no filtering, no debounce, and no dropdown to build.
  function addPicked(name: string) {
    const value = name.trim();
    if (!value || picked.includes(value)) return;
    setPicked([...picked, value]);
    setDraft("");
  }

  return (
    <form action={formAction} className="form form--grid">
      <FormField label="Title" htmlFor="title" full>
        <Input id="title" name="title" type="text" required />
      </FormField>

      <FormField
        label="Message"
        htmlFor="body"
        full
        hint={
          <>
            <span>Markdown works here, same as a tournament description. More infos</span>{" "}
            <a
              style={{ color: "var(--c-accent)" }}
              href="https://gist.github.com/allysonsilva/85fff14a22bbdf55485be947566cc09e"
            >
              here
            </a>
            .
          </>
        }
      >
        <Textarea id="body" name="body" rows={10} required />
      </FormField>

      <FormField label="Send to" htmlFor="audience">
        <Select
          id="audience"
          name="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value as Audience)}
        >
          {(Object.keys(AUDIENCES) as Audience[]).map((value) => (
            <option key={value} value={value}>
              {AUDIENCES[value]}
            </option>
          ))}
        </Select>
      </FormField>

      {audience === "tournament" ? (
        <FormField label="Tournament" htmlFor="slug">
          <Select id="slug" name="slug" defaultValue={tournaments[0]?.slug}>
            {tournaments.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      {audience === "players" ? (
        <FormField
          label="Players"
          htmlFor="playerName"
          full
          hint="Start typing a Dueling Nexus name and pick it from the list. Add as many as you need."
        >
          <div className="form__inline">
            <Input
              id="playerName"
              list="player-names"
              value={draft}
              autoComplete="off"
              placeholder="Nexus name"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Enter in this field means "add", not "submit the message".
                  e.preventDefault();
                  addPicked(draft);
                }
              }}
            />
            <Button type="button" onClick={() => addPicked(draft)}>
              Add
            </Button>
          </div>
          <datalist id="player-names">
            {playerNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="form__chips">
            {picked.map((name) => (
              <span key={name} className="badge">
                {name}
                <input type="hidden" name="players" value={name} />
                <button
                  type="button"
                  className="badge__remove"
                  aria-label={`Remove ${name}`}
                  onClick={() => setPicked(picked.filter((n) => n !== name))}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </FormField>
      ) : null}

      {state.error ? (
        <p role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}
      {state.sent ? <Notice variant="done">{state.sent}</Notice> : null}

      <Button variant="solid" type="submit" pending={pending} pendingLabel="Sending...">
        Send message
      </Button>
    </form>
  );
}
