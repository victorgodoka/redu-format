"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { completeBracketAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";
import type { ActionResult } from "@/lib/actions-utils";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";

const initialState: ActionResult = { success: true };

export default function CompleteBracketButton({ slug }: { slug: string }) {
  const [state, dispatch] = useActionState(completeBracketAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success === false && state.error) {
      toast.error("Error", state.error);
    }
    if (state.success === true && state.description) {
      toast.success("Success", state.description);
    }
  }, [state, toast]);

  return (
    <form action={dispatch}>
      <input type="hidden" name="slug" value={slug} />
      <Button variant="solid" type="submit">
        Complete tournament
      </Button>
      {state.success === false && state.error && (
        <Notice variant="error" className="mt-2">{state.error}</Notice>
      )}
    </form>
  );
}
