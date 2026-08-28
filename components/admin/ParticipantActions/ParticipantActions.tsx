"use client";

import { useActionState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { Participant } from "@/lib/tournaments";
import styles from "./ParticipantActions.module.css";
import { contestPaymentAction, reinstateParticipantAction } from "@/app/admin/(protected)/tournaments/[slug]/participants/actions";
import { useToast } from "@/components/ui/Toast";
import { ParticipantForm } from "./Participant-form";
import { SetStateAction } from "react";
import { ActionKind } from "../ParticipantCards/ParticipantCards";
import type { ActionResult } from "@/lib/actions-utils";

const initialState: ActionResult = { success: true };

interface ParticipantActionsProps {
  acting: string | null;
  slug: string;
  tournamentName: string;
  canLink: boolean;
  active: boolean;
  isPaid: boolean;
  started: boolean;
  p: Participant;
  open: (value: SetStateAction<{ id: string; kind: ActionKind } | null>) => void;
}

const ParticipantActions = ({ active, canLink, started, p, open, isPaid, slug }: ParticipantActionsProps) => {
  const { toast } = useToast();

  const [contestState, contestDispatch] = useActionState(contestPaymentAction, initialState);
  const [reinstateState, reinstateDispatch] = useActionState(reinstateParticipantAction, initialState);

  useEffect(() => {
    const currentState = contestState.success === false ? contestState : reinstateState;
    if (currentState?.success === false && currentState.error) {
      toast.error("Error", currentState.error);
    }
    if (currentState?.success === true && currentState.description) {
      toast.success("Success", currentState.description);
    }
  }, [contestState, reinstateState, toast]);

  return <div className={styles.wrapper}>
    <Button type="button" variant="quiet" onClick={() => open({ id: p.id, kind: "deck" })}>
      Change Deck
    </Button>

    {canLink ? (
      <Button type="button" variant="quiet" onClick={() => open({ id: p.id, kind: "link" })}>
        Link account
      </Button>
    ) : null}

    {active && started ? (
      <Button type="button" variant="quiet" onClick={() => open({ id: p.id, kind: "dq" })}>
        Disqualify
      </Button>
    ) : null}

    {isPaid ? (
      <Button variant="solid" type="button" onClick={() => open({ id: p.id, kind: "payment" })}>
        {p.paymentStatus === "confirmed" ? "Re-confirm" : "Confirm entry"}
      </Button>
    ) : null}
    {isPaid && p.paymentStatus === "confirmed" ? (
      <ParticipantForm action={contestDispatch} slug={slug} p={p} buttonText="Contest" variant="danger" />
    ) : null}

    {p.disqualifiedAt ? (
      <ParticipantForm action={reinstateDispatch} slug={slug} p={p} buttonText="Undo disqualification" variant="danger" />
    ) : p.droppedAt ? (
      <ParticipantForm action={reinstateDispatch} slug={slug} p={p} buttonText="Re-add to tournament" variant="danger" />
    ) : (
      <Button variant="danger" type="button" onClick={() => open({ id: p.id, kind: "drop" })}>
        Drop
      </Button>
    )}
  </div>
}

export default ParticipantActions;