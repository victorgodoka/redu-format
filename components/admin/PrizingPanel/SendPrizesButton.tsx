"use client";

import { useActionState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { sendPrizesAction } from "@/app/admin/(protected)/tournaments/actions";
import type { ActionResult } from "@/lib/actions-utils";
import DeleteButton from "@/components/admin/DeleteButton";

const initialState: ActionResult = { success: true };

export default function SendPrizesButton({
  slug,
  unsentCount,
}: {
  slug: string;
  unsentCount: number;
}) {
  const [state, dispatch] = useActionState(sendPrizesAction, initialState);
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
      confirmText={`Send ${unsentCount} prize code(s) to the players' inboxes? This can only be done once.`}
      label="Send prizing"
      variant="solid"
    />
  );
}
