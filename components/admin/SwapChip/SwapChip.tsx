"use client";

import { useRef, useState } from "react";
import { swapPlayersAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";

/**
 * A player's name, draggable onto another match's chip to swap the two
 * between their pairings - drag-and-drop is just the trigger, the actual
 * move happens through swapPlayersAction (results.service.ts's swapPlayers),
 * exactly like any other action on this page. The dragged player's id
 * travels in the native DataTransfer payload, so no cross-component state is
 * needed to know what's being dragged.
 *
 * `disabled` for a settled match: swapPlayers() itself refuses an ended
 * match, this just skips offering a control that would only ever error.
 */
export default function SwapChip({
  slug,
  playerId,
  name,
  winner,
  disabled,
}: {
  slug: string;
  playerId: string;
  name: string;
  winner: boolean;
  disabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const className = [
    "swap-chip",
    disabled ? "" : "swap-chip--draggable",
    winner ? "swap-chip--winner" : "",
    dragOver ? "swap-chip--over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <span
        draggable={!disabled}
        className={className}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", playerId);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const sourceId = e.dataTransfer.getData("text/plain");
          if (!sourceId || sourceId === playerId || !targetRef.current) return;
          targetRef.current.value = sourceId;
          formRef.current?.requestSubmit();
        }}
      >
        {name}
      </span>
      <form ref={formRef} action={swapPlayersAction} hidden>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="playerAId" value={playerId} />
        <input ref={targetRef} type="hidden" name="playerBId" />
      </form>
    </>
  );
}
