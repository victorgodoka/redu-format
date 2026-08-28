"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { extendRoundAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";
import type { ActionResult } from "@/lib/actions-utils";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";

const initialState: ActionResult = { success: true };

export default function ExtendRoundForm({
  slug,
  openRoundLabel,
}: {
  slug: string;
  openRoundLabel: string;
}) {
  const [state, dispatch] = useActionState(extendRoundAction, initialState);
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
    <form action={dispatch} className="extend-round">
      <input type="hidden" name="slug" value={slug} />
      <span className="extend-round__label">Extend {openRoundLabel} deadline</span>
      <div className="extend-round__row">
        <input
          type="number"
          name="amount"
          min={1}
          placeholder="e.g. 4"
          required
          aria-label="Amount of time to extend the deadline by"
        />
        <select name="unit" defaultValue="hours" aria-label="Unit">
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
        <Button type="submit">Extend</Button>
      </div>
      {state.success === false && state.error && (
        <Notice variant="error" className="mt-2">{state.error}</Notice>
      )}
    </form>
  );
}
