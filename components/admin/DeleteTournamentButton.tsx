"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { deleteTournamentAction } from "@/app/admin/(protected)/tournaments/actions";
import type { ActionResult } from "@/lib/actions-utils";
import DeleteButton from "./DeleteButton";

const initialState: ActionResult = { success: true };

export default function DeleteTournamentButton({
  slug,
  tournamentName,
}: {
  slug: string;
  tournamentName: string;
}) {
  const [state, dispatch] = useActionState(deleteTournamentAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.success === false && state.error) {
      toast.error("Error", state.error);
    }
    // A successful delete will redirect, so no success toast is needed.
  }, [state, toast]);

  return (
    <DeleteButton
      action={dispatch}
      hidden={{ slug }}
      confirmText={`Delete ${tournamentName}? This cannot be undone.`}
    />
  );
}
