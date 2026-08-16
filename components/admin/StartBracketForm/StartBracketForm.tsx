"use client";

import { useActionState } from "react";
import Button from "@/components/ui/Button";
import {
  startBracketAction,
  type BracketFormState,
} from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";

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
      <Button variant="solid" type="submit" pending={pending} pendingLabel="Starting...">
        Start bracket
      </Button>
    </form>
  );
}
