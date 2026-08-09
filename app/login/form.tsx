"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="form">
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
        We exchange the token once for your public profile, then discard it. It
        is never stored and never sent to your browser.
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
