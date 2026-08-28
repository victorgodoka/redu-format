"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { repairRoundAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";
import type { ActionResult } from "@/lib/actions-utils";
import DeleteButton from "@/components/admin/DeleteButton";
import Notice from "@/components/ui/Notice";

const initialState: ActionResult = { success: true };

export default function RepairRoundButton({
  slug,
  round,
}: {
  slug: string;
  round: number;
}) {
  const [state, dispatch] = useActionState(repairRoundAction, initialState);
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
    <div>
      <DeleteButton
        action={dispatch}
        hidden={{ slug }}
        label={`Re-pair round ${round}`}
        confirmText={`Re-pair round ${round}? Every match in it is voided - results, reports and duel rooms included - and the round is drawn again from the current standings, including anyone who registered after the bracket was generated. Swiss pairings are not deterministic, so who plays whom will likely change even if nothing else did. Players are notified. This cannot be undone.`}
      />
      {state.success === false && state.error && (
        <Notice variant="error" className="mt-2">{state.error}</Notice>
      )}
    </div>
  );
}
