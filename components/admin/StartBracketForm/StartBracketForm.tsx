"use client";

import { useActionState, useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import type { Participant } from "@/lib/tournaments";
import {
  startBracketAction,
} from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";
import styles from "./StartBracketForm.module.css";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions-utils";
import Notice from "@/components/ui/Notice";

const initialState: ActionResult = { success: true };

export default function StartBracketForm({
  slug,
  participants,
  seedable,
}: {
  slug: string;
  participants: Participant[];
  seedable: boolean;
}) {
  const [state, dispatch] = useActionState(startBracketAction, initialState);
  const { toast } = useToast();
  const [order, setOrder] = useState(participants.map((p) => p.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const byId = new Map(participants.map((p) => [p.id, p]));

  useEffect(() => {
    if (state?.success === false && state.error) {
      toast.error("Error", state.error);
    }
    // A successful start will cause a page reload/redirect, so no success toast needed.
  }, [state, toast]);

  function moveOver(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setOrder((current) => {
      const from = current.indexOf(dragId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }

  return (
    <form action={dispatch}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="seedOrder" value={seedable ? order.join(",") : ""} />

      {seedable && participants.length > 1 ? (
        <ol className={styles.seedList}>
          {order.map((id, index) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <li
                key={id}
                className={styles.seedRow}
                draggable
                onDragStart={() => setDragId(id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  moveOver(id);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <span className={styles.seedNumber}>#{index + 1}</span>
                <span className={styles.seedName}>{p.name}</span>
                <span className={styles.seedHandle} aria-hidden="true">
                  ⠿
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {state.success === false && state.error && (
        <Notice variant="error">{state.error}</Notice>
      )}

      <Button variant="solid" type="submit" pendingLabel="Starting...">
        Start bracket
      </Button>
    </form>
  );
}
