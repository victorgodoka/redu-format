"use client"

import { useActionState, useEffect } from "react";
import { addParticipantAction } from "@/app/admin/(protected)/tournaments/[slug]/participants/actions";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions-utils";
import Notice from "@/components/ui/Notice";

interface ParticipantAddFormProps {
  slug: string
  playerNames: string[]
}

const initialState: ActionResult = { success: true };

const ParticipantAddForm = ({ slug, playerNames }: ParticipantAddFormProps) => {
  const [state, dispatch] = useActionState(addParticipantAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success === false && state.error) {
      toast.error("Error", state.error);
    }
    if (state.success === true && state.description) {
      toast.success("Success", state.description);
    }
  }, [state, toast]);

  return <form action={dispatch} className="form form--flex">
...
    <FormField
      label="Duelist name"
      htmlFor="name"
      hint="Pick a registered duelist to register them exactly as their own signup would - identity, inbox, prizing and deck lock all included. A name nobody here owns still goes in, as a plain entry."
    >
      {/* Plain datalist: the browser does the matching, so the page stays
              a server component and there is no dropdown to build. */}
      <Input id="name" name="name" type="text" list="registered-players" autoComplete="off" required />
      <datalist id="registered-players">
        {playerNames.map((playerName) => (
          <option key={playerName} value={playerName} />
        ))}
      </datalist>
    </FormField>

    <FormField
      label="Deck UUID"
      htmlFor="deckName"
    >
      <Input id="deckName" name="deckName" type="text" autoComplete="off" required />
    </FormField>

    {state.success === false && state.error ? (
      <Notice variant="error" className="full-width">{state.error}</Notice>
    ) : null}

    <Button variant="solid" type="submit" pendingLabel="Adding...">
      Add participant
    </Button>
  </form>
}

export default ParticipantAddForm;