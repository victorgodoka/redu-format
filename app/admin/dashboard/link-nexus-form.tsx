"use client";

import { useActionState } from "react";
import { linkNexusToken, type LinkNexusState } from "./actions";

const initial: LinkNexusState = {};

export default function LinkNexusForm() {
  const [state, action, pending] = useActionState(linkNexusToken, initial);

  return (
    <form action={action} className="form">
      <label htmlFor="nexus-token">Dueling Nexus token</label>
      <input
        id="nexus-token"
        name="token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required
        aria-describedby={state.error ? "nexus-token-error" : undefined}
        aria-invalid={state.error ? true : undefined}
      />
      <p className="form__hint">
        Linking your Dueling Nexus token ties your account to this admin
        login, kept in the same signed session as your Discord identity.
      </p>
      {state.error ? (
        <p id="nexus-token-error" role="alert" className="form__error">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn--solid" type="submit" disabled={pending}>
        {pending ? "Checking..." : "Link account"}
      </button>
    </form>
  );
}
