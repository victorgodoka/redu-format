"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { cancelTournamentAction } from "@/app/admin/(protected)/tournaments/actions";
import type { ActionResult } from "@/lib/actions-utils";
import DeleteButton from "./DeleteButton";

const initialState: ActionResult = { success: true };

export default function CancelTournamentButton({
  slug,
  tournamentName,
}: {
  slug: string;
  tournamentName: string;
}) {
  const [state, dispatch] = useActionState(cancelTournamentAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.success === false && state.error) {
      toast.error("Error", state.error);
    }
    if (state?.success === true && state.description) {
      toast.success("Success", state.description);
    }
  }, [state, toast]);

  return (
    <DeleteButton
      action={dispatch}
      hidden={{ slug }}
      confirmText={`Cancel ${tournamentName}? It won't generate placings or count for the ranking. This can't be undone.`}
      label="Cancel tournament"
    />
  );
}
