"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { removePrizeAction } from "@/app/admin/(protected)/tournaments/actions";
import type { ActionResult } from "@/lib/actions-utils";
import DeleteButton from "@/components/admin/DeleteButton";

const initialState: ActionResult = { success: true };

export default function RemovePrizeButton({
  slug,
  prizeId,
  prizeCode,
}: {
  slug: string;
  prizeId: string;
  prizeCode: string;
}) {
  const [state, dispatch] = useActionState(removePrizeAction, initialState);
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
      hidden={{ slug, prizeId }}
      confirmText={`Remove the code ${prizeCode}?`}
      label="Remove"
    />
  );
}
