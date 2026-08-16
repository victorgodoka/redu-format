"use client";

import { useActionState } from "react";
import { startBracketAction, type BracketFormState } from "./actions";

const initial: BracketFormState = {};

export default function StartBracketForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(startBracketAction, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      {state.error ? (
        <p role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn--solid" type="submit" disabled={pending}>
        {pending ? "Starting..." : "Start bracket"}
      </button>
    </form>
  );
}
