"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="token">Dueling Nexus token</label>
      <input
        id="token"
        name="token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required
        aria-describedby={state.error ? "token-error" : undefined}
        aria-invalid={state.error ? true : undefined}
      />
      <p className="form__hint">
        You can view your token by going to your{" "}
        <a
          href="https://duelingnexus.com/profile"
          target="_blank"
          rel="noopener noreferrer"
        >
          Dueling Nexus profile
        </a>
        , selecting the options menu on the top right of the screen with the
        gear icon, clicking Token, and then copying and pasting it into this
        field.
      </p>
      <p className="form__hint">
        The token is kept in an encrypted cookie so we can re-read your decks
        later. It is refreshed automatically, and you can force it from your
        dashboard. If Dueling Nexus ever rejects it, we drop it and ask you for
        a new one.
      </p>
      {state.error ? (
        <p id="token-error" role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn--solid" type="submit" disabled={pending}>
        {pending ? "Checking..." : "Sign in"}
      </button>
    </form>
  );
}
