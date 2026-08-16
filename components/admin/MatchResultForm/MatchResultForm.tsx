"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import FormGroup from "@/components/ui/FormGroup";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import { enterResultAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";

type Result = "1" | "0" | "draw";
type PlayerOption = { name: string; defaultValue: Result };

/** A draw only makes sense for both sides at once; otherwise exactly one side wins. */
function isValidCombo(p1: Result, p2: Result): boolean {
  if (p1 === "draw" || p2 === "draw") return p1 === "draw" && p2 === "draw";
  return p1 !== p2;
}

/**
 * A settled result starts locked (both selects disabled) so a click doesn't
 * accidentally resubmit it. "Change result" doesn't submit anything itself -
 * it just unlocks the selects and turns back into a "Report" button, which
 * is what actually submits the new result. Submission is blocked client-side
 * on an incoherent combo (both win, both loss, one draw one not) - the
 * server rejects the same combos too, but silently, so this is what actually
 * tells the admin why nothing happened.
 */
export default function MatchResultForm({
  slug,
  matchId,
  player1,
  player2,
  hasResult,
}: {
  slug: string;
  matchId: string;
  player1: PlayerOption;
  player2: PlayerOption;
  hasResult: boolean;
}) {
  const [editing, setEditing] = useState(!hasResult);
  const [p1Result, setP1Result] = useState<Result>(player1.defaultValue);
  const [p2Result, setP2Result] = useState<Result>(player2.defaultValue);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!isValidCombo(p1Result, p2Result)) {
      e.preventDefault();
      setError("Pick a draw for both sides, or a win for exactly one of them.");
      return;
    }
    setError(null);
  }

  return (
    <form
      action={enterResultAction}
      className="payment-controls__confirm"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="matchId" value={matchId} />
      <FormGroup>
        <div className="form__field">
          <Label>
            {player1.name}
            <Select
              name="player1Wins"
              value={p1Result}
              onChange={(e) => setP1Result(e.target.value as Result)}
              disabled={!editing}
              required
            >
              <option value="1">Win</option>
              <option value="draw">Draw</option>
              <option value="0">Loss</option>
            </Select>
          </Label>
        </div>
        <div className="form__field">
          <Label>
            {player2.name}
            <Select
              name="player2Wins"
              value={p2Result}
              onChange={(e) => setP2Result(e.target.value as Result)}
              disabled={!editing}
              required
            >
              <option value="1">Win</option>
              <option value="draw">Draw</option>
              <option value="0">Loss</option>
            </Select>
          </Label>
        </div>

        <Button
          variant="solid"
          type={editing ? "submit" : "button"}
          onClick={editing ? undefined : () => setEditing(true)}
        >
          {editing ? "Report" : "Change result"}
        </Button>
      </FormGroup>
      {error ? (
        <p role="alert" className="form__error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
